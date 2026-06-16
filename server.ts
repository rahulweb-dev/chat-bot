import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, ".env.local") });
config({ path: resolve(__dirname, ".env") });

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initSocketServer } from "./src/server/socket";
import { initWhatsAppWorker } from "./src/lib/queue/whatsappWorker";
import { initCampaignScheduler } from "./src/lib/queue/campaignScheduler";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
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

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.IO initialized`);
    console.log(`> WhatsApp worker + campaign scheduler initialized`);
  });
});
