"use client";

import { useRef, useEffect, useState } from "react";
import { useChatStore } from "@/lib/store/chat-store";
import { useTreeStore } from "@/lib/store/tree-store";
import { createClient } from "@/lib/supabase/client";
import { toolCallToPendingChange } from "@/lib/ai/parse";
import { applyChecklistTool } from "@/lib/ai/apply-checklist";
import { toast } from "sonner";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { PendingChange } from "./PendingChange";
import type { ToolCall, ChatMessage as ChatMessageType } from "@/types/chat";
import type { SkillNode, EdgeType } from "@/types/skill-tree";

interface ChatPanelProps {
  treeId: string;
  onCollapse?: () => void;
}

export function ChatPanel({ treeId, onCollapse }: ChatPanelProps) {
  const {
    messages, isStreaming, streamingContent, suggestions,
    addMessage, setMessages, clearMessages, setStreaming, appendStreamContent, resetStreamContent,
    setSuggestions, clearSuggestions,
  } = useChatStore();

  const [confirmClear, setConfirmClear] = useState(false);

  const { pendingChanges, addPendingChange, resolveAllPending, addNode, removeNode, updateNode, updateNodeContent, nodes, addEdge, removeEdge, pushHistory } = useTreeStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadMessages() {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("tree_id", treeId)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data) setMessages(data as ChatMessageType[]);
    }
    loadMessages();
  }, [treeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  function resolveNodeId(proposedId: string): string {
    const existingIds = new Set(nodes.map((n) => n.id));
    if (!existingIds.has(proposedId)) return proposedId;
    // ID conflict: find next available item-NNN
    const itemNums = Array.from(existingIds)
      .map((id) => {
        const m = id.match(/^item-(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
    const maxNum = itemNums.length > 0 ? Math.max(...itemNums) : 0;
    let next = maxNum + 1;
    while (existingIds.has(`item-${next}`)) next++;
    return `item-${next}`;
  }

  async function acceptAll() {
    pushHistory();
    const pending = pendingChanges.filter((c) => c.status === "pending");
    for (const change of pending) {
      if (change.action === "add_node") {
        const resolvedId = resolveNodeId(change.params.id as string);
        const node: SkillNode = {
          id: resolvedId,
          tree_id: treeId,
          label: change.params.label as string,
          description: (change.params.description as string) ?? null,
          status: (change.params.status as SkillNode["status"]) ?? "locked",
          type: ((change.params.type ?? change.params.role) as SkillNode["type"]) ?? "planet",
          role: ((change.params.type ?? change.params.role) as SkillNode["role"]) ?? "planet",
          parent_id: (change.params.parent_id as string) ?? null,
          priority: (change.params.priority as number) ?? 3,
          position_x: 0,
          position_y: 0,
          content: { blocks: [] },
          icon: null,
          metadata: null,
          properties: {},
        };
        addNode(node);
        await supabase.from("skill_nodes").insert(node);
      } else if (change.action === "remove_node") {
        const nodeId = change.params.id as string;
        removeNode(nodeId);
        await supabase.from("skill_nodes").delete().eq("id", nodeId);
        await supabase.from("skill_nodes").delete().eq("tree_id", treeId).eq("parent_id", nodeId);
      } else if (change.action === "update_node") {
        const nodeId = change.params.id as string;
        const updates: Partial<SkillNode> = {};
        if (change.params.label) updates.label = change.params.label as string;
        if (change.params.description) updates.description = change.params.description as string;
        if (change.params.status) updates.status = change.params.status as SkillNode["status"];
        if (change.params.type ?? change.params.role) {
          const t = ((change.params.type ?? change.params.role) as SkillNode["type"]);
          updates.type = t;
          updates.role = t;
        }
        if (change.params.parent_id !== undefined) updates.parent_id = change.params.parent_id as string | null;
        if (change.params.priority) updates.priority = change.params.priority as number;
        updateNode(nodeId, updates);
        await supabase.from("skill_nodes").update(updates).eq("id", nodeId);
      } else if (change.action === "add_edge") {
        await addEdge({
          id: change.params.id as string,
          source_id: change.params.source_id as string,
          target_id: change.params.target_id as string,
          type: (change.params.type as EdgeType) ?? "related",
          label: (change.params.label as string) ?? null,
          weight: (change.params.weight as number) ?? 1.0,
        });
      } else if (change.action === "remove_edge") {
        await removeEdge(change.params.id as string);
      } else if (change.action === "manage_relationship") {
        if (change.params.action === "remove") {
          await removeEdge(change.params.id as string);
        } else {
          // create
          await addEdge({
            id: change.params.id as string,
            source_id: change.params.source_id as string,
            target_id: change.params.target_id as string,
            type: (change.params.type as EdgeType) ?? "related",
            label: (change.params.label as string) ?? null,
            weight: (change.params.weight as number) ?? 1.0,
          });
        }
      } else if (change.action === "update_properties") {
        const nodeId = change.params.node_id as string;
        const updates: Partial<SkillNode> = {};
        // Status and priority are first-class columns on the node
        if (change.params.status !== undefined) updates.status = change.params.status as SkillNode["status"];
        if (change.params.priority !== undefined) updates.priority = change.params.priority as number;
        // due_date and assignee live in the node's properties jsonb column
        const existingNode = nodes.find((n) => n.id === nodeId);
        const existingProps = existingNode?.data.properties ?? {};
        const newProps = { ...existingProps };
        if (change.params.due_date !== undefined) {
          if (change.params.due_date === null) delete newProps.due_date;
          else newProps.due_date = change.params.due_date;
        }
        if (change.params.assignee !== undefined) {
          if (change.params.assignee === null) delete newProps.assignee;
          else newProps.assignee = change.params.assignee;
        }
        const fullUpdates = { ...updates, properties: newProps };
        updateNode(nodeId, fullUpdates);
        await supabase.from("skill_nodes").update(fullUpdates).eq("id", nodeId).eq("tree_id", treeId);
      } else if (
        change.action === "update_content" ||
        change.action === "set_checklist" ||
        change.action === "add_checklist_items" ||
        change.action === "update_checklist_item"
      ) {
        const nodeId = change.params.node_id as string;
        const toolCall: ToolCall = { id: change.id, name: change.action, input: change.params };
        const existingNode = nodes.find((n) => n.id === nodeId);
        const existingContent = existingNode?.data.content ?? { blocks: [] };
        const newContent = applyChecklistTool(toolCall, existingContent);
        if (newContent) {
          updateNodeContent(nodeId, newContent);
          await supabase
            .from("skill_nodes")
            .update({ content: newContent })
            .eq("id", nodeId)
            .eq("tree_id", treeId);
        }
      }
    }
    resolveAllPending(true);
    const count = pending.length;
    toast.success(`Accepted ${count} change${count !== 1 ? "s" : ""}`);
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

  async function handleClear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    await supabase.from("chat_messages").delete().eq("tree_id", treeId);
    clearMessages();
    toast.success("Conversation cleared");
  }

  async function sendMessage(content: string) {
    clearSuggestions();

    // Intercept /clear command
    if (content.trim().toLowerCase() === "/clear") {
      await supabase.from("chat_messages").delete().eq("tree_id", treeId);
      clearMessages();
      toast.success("Conversation cleared");
      return;
    }

    // Intercept /pm pause and /pm resume commands
    const trimmed = content.trim().toLowerCase();
    if (trimmed === "/pm pause" || trimmed === "/pm resume") {
      const action = trimmed === "/pm pause" ? "pause" : "resume";
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
        const res = await fetch("/api/pm-control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        const icon = action === "pause" ? "⏸️" : "▶️";
        const replyContent = res.ok
          ? `${icon} **PM ${action === "pause" ? "Paused" : "Resumed"}**\n\n${data.message}`
          : `⚠️ Failed to ${action} PM: ${data.errors?.join(", ") ?? "Unknown error"}`;
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: replyContent,
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } catch {
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: `⚠️ Failed to ${action} PM. Please try again.`,
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } finally {
        setStreaming(false);
        resetStreamContent();
      }
      return;
    }

    // Intercept /pm priority <ITEM> command — move item to top of queue
    if (trimmed.startsWith("/pm priority ")) {
      const itemId = trimmed.slice("/pm priority ".length).trim();
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
        const res = await fetch("/api/pm-priority", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treeId, itemId }),
        });
        const data = await res.json();
        const replyContent = res.ok
          ? data.message
          : `⚠️ Failed to reprioritise: ${data.message ?? "Unknown error"}`;
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: replyContent,
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } catch {
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: "⚠️ Failed to set priority. Please try again.",
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } finally {
        setStreaming(false);
        resetStreamContent();
      }
      return;
    }

    // Intercept /pm next command
    if (content.trim().toLowerCase() === "/pm next") {
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
        const res = await fetch("/api/pm-next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treeId }),
        });
        const data = await res.json();
        const replyContent = res.ok
          ? data.message
          : `⚠️ Failed to advance ticket: ${data.message ?? "Unknown error"}`;
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: replyContent,
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } catch {
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: "⚠️ Failed to advance to next ticket. Please try again.",
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } finally {
        setStreaming(false);
        resetStreamContent();
      }
      return;
    }

    // Intercept /pm status command
    if (content.trim().toLowerCase() === "/pm status") {
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
        const res = await fetch(`/api/pm-status?treeId=${treeId}`);
        if (!res.ok) throw new Error("Failed to fetch PM status");
        const data = await res.json();

        const activeLine = data.inProgress
          ? `🔄 **Active:** ${data.inProgress.label} (\`${data.inProgress.id}\`)`
          : "⏸️ **Active:** No ticket in progress";

        const next3Lines =
          data.next3.length > 0
            ? data.next3
                .map(
                  (n: { id: string; label: string; priority: number }, i: number) =>
                    `  ${i + 1}. ${n.label} (\`${n.id}\`, priority ${n.priority})`
                )
                .join("\n")
            : "  *(none)*";

        const statusMsg = [
          `📊 **PM Status**`,
          ``,
          `Progress: **${data.completed}/${data.total}** tickets complete (${data.percentDone}%)`,
          ``,
          activeLine,
          ``,
          `📋 **Next 3 pending:**`,
          next3Lines,
        ].join("\n");

        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: statusMsg,
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } catch {
        addMessage({
          id: generateId(),
          tree_id: treeId,
          role: "assistant",
          content: "⚠️ Failed to fetch PM status. Please try again.",
          tool_calls: null,
          created_at: new Date().toISOString(),
        });
      } finally {
        setStreaming(false);
        resetStreamContent();
      }
      return;
    }

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
          } else if (event.type === "suggestions") {
            setSuggestions(event.data as string[]);
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

  const starterPrompts = [
    "I want to learn web development",
    "Build me a data science skill tree",
    "I'm studying for AWS certification",
    "Help me learn game development",
  ];

  return (
    <div className="w-full glass border-l border-glass-border flex flex-col">
      <div className="p-3 border-b border-glass-border flex items-center justify-between shrink-0">
        <h2 className="font-mono font-semibold text-sm">AI Assistant</h2>
        <div className="flex items-center gap-1">
          {confirmClear ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Clear all messages?</span>
              <button
                onClick={handleClear}
                className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] hover:bg-red-500/30 transition-colors"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 text-[10px] hover:bg-slate-700 transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={handleClear}
              className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded"
              title="Clear conversation"
              disabled={messages.length === 0}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-slate-500 hover:text-white transition-colors p-1 rounded"
              title="Collapse"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-slate-500 text-sm py-6">
            <p className="mb-3">What do you want to learn?</p>
            <div className="space-y-2">
              {starterPrompts.map((s) => (
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

        {!isStreaming && suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Follow-up</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-xs px-2.5 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue hover:bg-accent-blue/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
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
