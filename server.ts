import type { Server } from "http";
import type { NextServer } from "next/dist/server/next";

// Next.js normally polyfills globalThis.AsyncLocalStorage itself
// (node-environment-baseline.js) very early during its own CLI bootstrap. A
// custom server imports `next` directly instead of going through that CLI —
// and tsx compiles this file's `import` statements to CJS requires that ALL
// get hoisted above every plain statement, in file order (standard
// esbuild/CJS-interop behavior for ESM import syntax). That includes every
// other `import` below, not just `next` itself — so any of them transitively
// touching Next's app-render internals before this polyfill runs reproduces
// the same crash, no matter where this guard is written relative to them.
//
// The only reliable fix is to stop relying on import-hoisting order entirely:
// every runtime dependency in this file is loaded via plain require() below,
// which (unlike `import`) is never hoisted and always runs exactly where
// it's written — so this polyfill is now genuinely first.
/* eslint-disable @typescript-eslint/no-require-imports */
const { AsyncLocalStorage } = require("node:async_hooks");
if (typeof (globalThis as unknown as { AsyncLocalStorage?: unknown }).AsyncLocalStorage !== "function") {
  (globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
}

const { config } = require("dotenv") as typeof import("dotenv");
const { resolve } = require("path") as typeof import("path");
config({ path: resolve(__dirname, ".env.local") });
config({ path: resolve(__dirname, ".env") });

const { createServer } = require("http") as typeof import("http");
const { parse } = require("url") as typeof import("url");
const next: (opts: Record<string, unknown>) => NextServer = require("next");
const { initSocketServer } = require("./src/server/socket") as typeof import("./src/server/socket");
const { initWhatsAppWorker } = require("./src/lib/queue/whatsappWorker") as typeof import("./src/lib/queue/whatsappWorker");
const { initCampaignScheduler } = require("./src/lib/queue/campaignScheduler") as typeof import("./src/lib/queue/campaignScheduler");
const { initUsageAlertScheduler } = require("./src/lib/usage-monitor") as typeof import("./src/lib/usage-monitor");
const { initEmailWorker } = require("./src/lib/queue/emailWorker") as typeof import("./src/lib/queue/emailWorker");
const { initEmailCampaignScheduler } = require("./src/lib/queue/emailCampaignScheduler") as typeof import("./src/lib/queue/emailCampaignScheduler");
const { initRCSWorker } = require("./src/lib/queue/rcsWorker") as typeof import("./src/lib/queue/rcsWorker");
const { initRCSCampaignScheduler } = require("./src/lib/queue/rcsCampaignScheduler") as typeof import("./src/lib/queue/rcsCampaignScheduler");
/* eslint-enable @typescript-eslint/no-require-imports */

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer: Server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  initSocketServer(httpServer);
  initWhatsAppWorker();
  initCampaignScheduler();
  initUsageAlertScheduler();
  initEmailWorker();
  initEmailCampaignScheduler();
  initRCSWorker();
  initRCSCampaignScheduler();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO initialized`);
    console.log(`> WhatsApp worker + campaign scheduler initialized`);
    console.log(`> Usage alert scheduler initialized`);
    console.log(`> Email worker + campaign scheduler initialized`);
    console.log(`> RCS worker + campaign scheduler initialized`);
  });
});
