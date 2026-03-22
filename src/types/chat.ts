export interface ChatMessage {
  id: string;
  tree_id: string;
  role: "user" | "assistant";
  content: string;
  tool_calls: ToolCall[] | null;
  created_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type PendingChangeAction =
  | "add_node"
  | "remove_node"
  | "update_node"
  | "bulk_modify";

export interface PendingChange {
  id: string;
  action: PendingChangeAction;
  params: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
}

export interface SSEEvent {
  type: "text" | "tool_use" | "done" | "error";
  data: string | ToolCall;
}
