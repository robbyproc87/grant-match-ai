"use client";
import { useChat } from "ai/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type InitialMessage = { id: string; role: "user" | "assistant"; content: string };

export function ChatClient({
  orgId,
  initialMessages,
}: {
  orgId: string;
  initialMessages: InitialMessage[];
}) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: { orgId },
    initialMessages,
    onError: (err) => {
      toast.error(`Chat failed: ${err.message}`);
    },
  });

  return (
    <Card className="animate-fade-in overflow-hidden">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            🤖
          </div>
          <div>
            <div className="text-sm font-semibold">Grant Writing Assistant</div>
            <div className="text-xs text-emerald-500">● Online</div>
          </div>
        </div>
      </div>
      <div className="max-h-[60vh] min-h-64 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="px-2 text-sm text-muted-foreground">
            Ask anything about your grant strategy, narrative writing, budget framing,
            or how to stand out.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[80%] whitespace-pre-wrap rounded-2xl bg-secondary px-4 py-2.5 text-sm"
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about grants, narratives, standing out…"
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            →
          </Button>
        </div>
      </form>
    </Card>
  );
}
