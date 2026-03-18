import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, RotateCcw, User, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

type Message = {
  role: "user" | "assistant";
  content: string;
  actionTaken?: boolean;
};

// ── Simple markdown-lite renderer ─────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const output: JSX.Element[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Blank line → small gap
    if (line.trim() === "") {
      output.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Bullet point
    if (/^[-*•]\s/.test(line)) {
      output.push(
        <div key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-1 text-muted-foreground shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(line.replace(/^[-*•]\s/, "")) }} />
        </div>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      output.push(
        <div key={key++} className="flex gap-2 text-sm leading-relaxed">
          <span className="mt-0 font-semibold shrink-0 text-muted-foreground">{num}.</span>
          <span dangerouslySetInnerHTML={{ __html: inlineFormat(line.replace(/^\d+\.\s/, "")) }} />
        </div>
      );
      continue;
    }

    // Heading (### or ##)
    if (/^#{1,3}\s/.test(line)) {
      const text = line.replace(/^#+\s/, "");
      output.push(
        <p key={key++} className="text-sm font-semibold mt-1 mb-0.5" dangerouslySetInnerHTML={{ __html: inlineFormat(text) }} />
      );
      continue;
    }

    // Normal paragraph
    output.push(
      <p key={key++} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    );
  }

  return output;
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-secondary px-1 rounded text-xs font-mono">$1</code>');
}

// ── Suggested starter questions ────────────────────────────────────────────────

const STARTERS = [
  "How do I set up a recurring weekly practice schedule?",
  "Which of my athletes have the most active goals right now?",
  "What's a good warm-up structure for a baseball practice?",
  "How do I invite a parent to view their athlete's progress?",
  "What sessions do I have coming up this week?",
  "How do I log a game and track athlete stats?",
];

// ── Component ──────────────────────────────────────────────────────────────────

const CoachAssistant = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("coach-assistant", {
        body: { messages: newMessages },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const invalidate: string[] = data.invalidate ?? [];
      if (invalidate.length) {
        invalidate.forEach((key: string) => queryClient.invalidateQueries({ queryKey: [key] }));
      }
      setMessages([...newMessages, { role: "assistant", content: data.content, actionTaken: invalidate.length > 0 }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Assistant error", description: msg, variant: "destructive" });
      // Remove the user message that failed so they can retry
      setMessages(messages);
      setInput(content);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <DashboardLayout role="coach">
      <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-['Space_Grotesk']">Coach Assistant</h1>
              <p className="text-xs text-muted-foreground">Powered by Claude · knows your athletes and schedule</p>
            </div>
          </div>
          {!isEmpty && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearConversation}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New chat
            </Button>
          )}
        </div>

        {/* Message area */}
        <div className="flex-1 overflow-y-auto rounded-xl border bg-secondary/20 p-4 space-y-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-semibold text-lg font-['Space_Grotesk']">How can I help you today?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  I have access to your athletes, goals, sessions, and schedule.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 px-3 py-2.5 transition-colors leading-snug"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                    msg.role === "assistant"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-secondary border border-border"
                  }`}>
                    {msg.role === "assistant"
                      ? <Bot className="h-3.5 w-3.5 text-primary" />
                      : <User className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-background border border-border rounded-tl-sm"
                  }`}>
                    {msg.role === "user" ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                        {msg.actionTaken && (
                          <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Applied to app
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 bg-primary/10 border border-primary/20">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-background border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input row */}
        <div className="mt-3 shrink-0">
          <div className="flex gap-2 items-end rounded-xl border bg-background p-2 focus-within:border-primary/40 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about your athletes, schedule, or coaching…"
              className="border-0 shadow-none resize-none min-h-[40px] max-h-[160px] focus-visible:ring-0 p-1 text-sm"
              rows={1}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CoachAssistant;
