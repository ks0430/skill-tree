"use client";

import { useState, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }

  return (
    <div className="p-3 border-t border-glass-border">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Describe skills you want to learn..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none px-3 py-2 rounded-lg bg-navy-800 border border-glass-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue text-sm disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="px-3 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1.5"
        >
          {disabled ? <Spinner className="w-3.5 h-3.5" /> : null}
          {disabled ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
