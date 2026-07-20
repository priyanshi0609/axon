import ChatWindow from "@/components/chat/ChatWindow";

export default function ChatPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Axon Copilot</h1>
      <p className="text-sm text-muted-foreground">
        Ask operational, maintenance, or compliance questions across every document you've uploaded.
      </p>
      <ChatWindow />
    </main>
  );
}
