import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { boostAgentChat } from "@/lib/boost-agent.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string; tools?: Array<{ name: string; output?: any }> };

export function BoostAgent({ moduleKey, intro }: { moduleKey: "roles" | "perform" | "pulse"; intro: string }) {
  const chat = useServerFn(boostAgentChat);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: intro }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { taRef.current?.focus(); }, [busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const res = await chat({ data: { moduleKey, messages: apiMessages } });
      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.text || "(no response)",
          tools: res.toolEvents?.map((t) => ({ name: t.name, output: t.output })),
        },
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Agent error");
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col h-[520px]">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">BOOST! Agent</div>
          <div className="text-xs text-muted-foreground">Implementation help for Boost!{moduleKey[0].toUpperCase() + moduleKey.slice(1)}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={m.role === "user"
              ? "max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
              : "max-w-[85%] space-y-2 text-sm"}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              {m.tools && m.tools.length > 0 && (
                <div className="space-y-1">
                  {m.tools.map((t, j) => (
                    <div key={j} className="flex items-start gap-2 rounded-md border bg-muted/40 px-2 py-1 text-xs">
                      <Wrench className="mt-0.5 h-3 w-3 text-muted-foreground" />
                      <div>
                        <span className="font-mono font-medium">{t.name}</span>
                        {t.output?.message && <div className="text-muted-foreground">{String(t.output.message)}</div>}
                        {t.output?.ok === false && <div className="text-destructive">Error: {String(t.output.error)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> BOOST! is thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask BOOST! to help set things up…"
            className="min-h-[44px] max-h-32 resize-none"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
