let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, startAt: number, duration: number, volume = 0.32) {
  const c = getCtx();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.frequency.value = freq;
  osc.type = "sine";
  const t = c.currentTime + startAt;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.01);
}

/** Single soft ding — new message */
export function playMessage() {
  try { tone(1047, 0, 0.22); } catch { /* browser blocked */ }
}

/** Two-note chime — new conversation or agent request */
export function playNewConversation() {
  try {
    tone(880, 0,    0.15);
    tone(1108, 0.18, 0.28);
  } catch { /* browser blocked */ }
}

/** Three ascending tones — lead created */
export function playLeadCreated() {
  try {
    tone(660, 0,    0.12);
    tone(880, 0.15, 0.12);
    tone(1100, 0.3, 0.32);
  } catch { /* browser blocked */ }
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: "supportflow-chat" });
  } catch { /* not supported */ }
}
