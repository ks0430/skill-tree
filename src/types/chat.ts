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
  | "bulk_modify"
  | "update_content"
  | "set_checklist"
  | "add_checklist_items"
  | "update_checklist_item"
  | "add_edge"
  | "remove_edge"
  | "manage_relationship";

export interface PendingChange {
  id: string;
  action: PendingChangeAction;
  params: Record<string, unknown>;
  status: "pending" | "accepted" | "rejected";
}

export interface SSEEvent {
  type: "text" | "tool_use" | "done" | "error" | "suggestions";
  data: string | ToolCall | string[];
}
