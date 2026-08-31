import IORedis from "ioredis";

// Same lesson as src/server/socket.ts: a module-level singleton can end up
// duplicated across Next.js's separately bundled module graphs. Store on
// globalThis so every copy of this module shares one real connection.
const globalForRedis = globalThis as unknown as { __redis?: IORedis; __loggedRedisError?: boolean };

const REDIS_OPTS = {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 1000, 30000),
};

export function getRedisConnection(): IORedis {
  if (globalForRedis.__redis) return globalForRedis.__redis;

  let connection: IORedis;
  try {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", REDIS_OPTS);
  } catch (err) {
    // A malformed REDIS_URL (e.g. pasting a `redis-cli --tls -u redis://...`
    // shell command instead of the bare connection string, an easy mistake when
    // copying from a Redis provider's dashboard) throws synchronously right here
    // — without this guard it crashes every route that calls rateLimit(), which
    // is nearly all of them including the widget chat endpoint, taking down live
    // chat for every visitor over one environment-variable typo. Falling back to
    // the unreachable default still works fine: connection errors past this point
    // are handled asynchronously below, and isRedisAvailable() already degrades
    // to an in-memory rate limiter when Redis can't be reached.
    console.error("[redis] REDIS_URL is not a valid connection string, falling back to localhost:", err instanceof Error ? err.message : err);
    connection = new IORedis("redis://localhost:6379", REDIS_OPTS);
  }

  // Without a listener, ioredis logs "Unhandled error event" on every failed
  // reconnect attempt — expected and harmless when Redis isn't running locally.
  connection.on("error", (err) => {
    if (!globalForRedis.__loggedRedisError) {
      console.warn("[redis] connection error (will keep retrying quietly):", err.message);
      globalForRedis.__loggedRedisError = true;
    }
  });
  connection.on("connect", () => {
    globalForRedis.__loggedRedisError = false;
    console.log("[redis] connected");
  });

  globalForRedis.__redis = connection;
  return connection;
}

// ioredis queues commands while disconnected and retries forever by default —
// without this guard, enqueueing against a dead Redis hangs the caller
// indefinitely instead of failing fast. Checking connection status + waiting
// for a "ready" event (rather than issuing a command) avoids adding to that
// offline queue ourselves.
export async function isRedisAvailable(timeoutMs = 1500): Promise<boolean> {
  const connection = getRedisConnection();
  if (connection.status === "ready") return true;

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      connection.off("ready", onReady);
      resolve(false);
    }, timeoutMs);

    function onReady() {
      clearTimeout(timer);
      resolve(true);
    }
    connection.once("ready", onReady);
  });
}
