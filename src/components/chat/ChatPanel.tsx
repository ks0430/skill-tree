"use client";

import { useRef, useEffect, useState } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { useTreeStore } from "@/lib/store/tree-store";
import { createClient } from "@/lib/supabase/client";
import { toolCallToPendingChange } from "@/lib/ai/parse";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { PendingChange } from "./PendingChange";
import type { ToolCall } from "@/types/chat";
import type { SkillNode } from "@/types/skill-tree";

interface ChatPanelProps {
  treeId: string;
}

export function ChatPanel({ treeId }: ChatPanelProps) {
  const {
    messages, isStreaming, streamingContent,
    addMessage, setStreaming, appendStreamContent, resetStreamContent,
  } = useChatStore();

  const { pendingChanges, addPendingChange, resolveAllPending, addNode, pushHistory } = useTreeStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const supabase = createClient();

  async function acceptAll() {
    pushHistory();
    const pending = pendingChanges.filter((c) => c.status === "pending");
    for (const change of pending) {
      if (change.action === "add_node") {
        const node: SkillNode = {
          id: change.params.id as string,
          tree_id: treeId,
          label: change.params.label as string,
          description: (change.params.description as string) ?? null,
          status: (change.params.status as SkillNode["status"]) ?? "locked",
          role: (change.params.role as SkillNode["role"]) ?? "planet",
          parent_id: (change.params.parent_id as string) ?? null,
          priority: (change.params.priority as number) ?? 3,
          position_x: 0,
          position_y: 0,
          icon: null,
          metadata: null,
        };
        addNode(node);
        await supabase.from("skill_nodes").insert(node);
      }
      // TODO: handle remove_node and update_node for bulk accept
    }
    resolveAllPending(true);
  }

  function rejectAll() {
    resolveAllPending(false);
  }

  function generateId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async function sendMessage(content: string) {
    const userMsg = {
      id: generateId(),
      tree_id: treeId,
      role: "user" as const,
      content,
      tool_calls: null,
      created_at: new Date().toISOString(),
    };
    addMessage(userMsg);
    setStreaming(true);
    resetStreamContent();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ treeId, message: content }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      const toolCalls: ToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6));

          if (event.type === "text") {
            fullContent += event.data;
            appendStreamContent(event.data);
          } else if (event.type === "tool_use") {
            const toolCall = event.data as ToolCall;
            toolCalls.push(toolCall);
            const changes = toolCallToPendingChange(toolCall);
            changes.forEach((c) => addPendingChange(c));
          } else if (event.type === "error") {
            fullContent += `\n\n*Error: ${event.data}*`;
          }
        }
      }

      addMessage({
        id: generateId(),
        tree_id: treeId,
        role: "assistant",
        content: fullContent,
        tool_calls: toolCalls.length ? toolCalls : null,
        created_at: new Date().toISOString(),
      });
    } catch {
      addMessage({
        id: generateId(),
        tree_id: treeId,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        tool_calls: null,
        created_at: new Date().toISOString(),
      });
    } finally {
      setStreaming(false);
      resetStreamContent();
    }
  }

  const activePending = pendingChanges.filter((c) => c.status === "pending");

  const suggestions = [
    "I want to learn web development",
    "Build me a data science skill tree",
    "I'm studying for AWS certification",
    "Help me learn game development",
  ];

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex flex-col items-center justify-center gap-1 px-1.5 py-4 glass border-l border-glass-border text-slate-400 hover:text-white transition-colors shrink-0"
        title="Expand AI Assistant"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="text-[10px] font-mono tracking-widest" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>AI</span>
      </button>
    );
  }

  return (
    <div className="w-96 glass border-l border-glass-border flex flex-col shrink-0">
      <div className="p-3 border-b border-glass-border flex items-center justify-between">
        <h2 className="font-mono font-semibold text-sm">AI Assistant</h2>
        <button
          onClick={() => setCollapsed(true)}
          className="text-slate-500 hover:text-white transition-colors p-1 rounded"
          title="Collapse"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-slate-500 text-sm py-6">
            <p className="mb-3">What do you want to learn?</p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-navy-800/50 border border-glass-border text-slate-400 hover:text-white hover:border-accent-blue/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingContent && (
          <div className="glass rounded-lg p-3 text-sm text-slate-300">
            {streamingContent}
            <span className="animate-pulse">|</span>
          </div>
        )}

        {activePending.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                {activePending.length} proposed change{activePending.length > 1 ? "s" : ""}
              </p>
              {activePending.length > 1 && (
                <div className="flex gap-1.5">
                  <button
                    onClick={acceptAll}
                    className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] hover:bg-emerald-500/30 transition-colors"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={rejectAll}
                    className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30 transition-colors"
                  >
                    Reject All
                  </button>
                </div>
              )}
            </div>
            {activePending.map((change) => (
              <PendingChange key={change.id} change={change} treeId={treeId} />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  );
}
