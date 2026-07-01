import Pusher from "pusher";

let _pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (_pusher) return _pusher;
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } = process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) return null;
  _pusher = new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
  return _pusher;
}

export async function triggerChat(
  conversationId: string,
  data: { id: string; content: string; senderType: string; senderName?: string | null; createdAt: Date | string }
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(`chat-${conversationId}`, "message", data).catch((e) =>
    console.error("[Pusher] trigger failed:", e?.message)
  );
}

export async function triggerTyping(
  conversationId: string,
  data: { isTyping: boolean }
): Promise<void> {
  const pusher = getPusher();
  if (!pusher) return;
  await pusher.trigger(`chat-${conversationId}`, "typing", data).catch(() => {});
}

export function pusherConfigured(): boolean {
  return !!(process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER);
}
