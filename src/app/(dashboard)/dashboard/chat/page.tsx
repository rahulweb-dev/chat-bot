import { LiveChat } from "@/components/chat/live-chat";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Live Chat" };

export default function ChatPage() {
  return <LiveChat />;
}
