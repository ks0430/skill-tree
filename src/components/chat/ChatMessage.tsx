"use client";

import type { ChatMessage as ChatMessageType } from "@/types/chat";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`rounded-lg p-3 text-sm ${
        isUser
          ? "bg-accent-blue/10 border border-accent-blue/20 ml-6"
          : "glass mr-6"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
          {isUser ? "You" : "SkillForge AI"}
        </span>
      </div>
      <div className="text-slate-300 whitespace-pre-wrap">{message.content}</div>
      {message.tool_calls && message.tool_calls.length > 0 && (
        <div className="mt-2 text-[10px] text-slate-500">
          {message.tool_calls.length} change(s) proposed
        </div>
      )}
    </div>
  );
}
