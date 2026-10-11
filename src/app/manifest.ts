import type { MetadataRoute } from "next";

// Lets agents install the dashboard on their phone ("Add to Home screen") and
// open it straight into Live Chat, like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Convo360",
    short_name: "Convo360",
    description: "Reply to website and WhatsApp chats from your phone.",
    start_url: "/dashboard/chat",
    scope: "/",
    display: "standalone",
    background_color: "#F3F2EE",
    theme_color: "#15140F",
    icons: [{ src: "/app_icon.png", sizes: "any", type: "image/png", purpose: "any" }],
  };
}
