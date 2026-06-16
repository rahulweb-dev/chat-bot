import IORedis from "ioredis";

// Same lesson as src/server/socket.ts: a module-level singleton can end up
// duplicated across Next.js's separately bundled module graphs. Store on
// globalThis so every copy of this module shares one real connection.
const globalForRedis = globalThis as unknown as { __redis?: IORedis; __loggedRedisError?: boolean };

export function getRedisConnection(): IORedis {
  if (globalForRedis.__redis) return globalForRedis.__redis;

  const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 1000, 30000),
  });

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
