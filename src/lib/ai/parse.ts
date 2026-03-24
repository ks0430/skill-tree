import type { PendingChange, PendingChangeAction, ToolCall } from "@/types/chat";

export function toolCallToPendingChange(toolCall: ToolCall): PendingChange[] {
  if (toolCall.name === "bulk_modify") {
    const ops = (toolCall.input.operations as Array<{ action: string; params: Record<string, unknown> }>) ?? [];
    return ops.map((op, i) => ({
      id: `${toolCall.id}-${i}`,
      action: op.action as PendingChangeAction,
      params: op.params,
      status: "pending" as const,
    }));
  }

  return [
    {
      id: toolCall.id,
      action: toolCall.name as PendingChangeAction,
      params: toolCall.input,
      status: "pending" as const,
    },
  ];
}

export function describeChange(change: PendingChange): string {
  const { action, params } = change;
  // prefer type over role for display (backward compat)
  const nodeTag = (params.type ?? params.role) as string | undefined;
  const roleTag = nodeTag ? `[${nodeTag}] ` : "";
  switch (action) {
    case "add_node":
      return `Add ${roleTag}"${params.label}"`;
    case "remove_node":
      return `Remove "${params.id}"`;
    case "update_node":
      return `Update "${params.id}"`;
    case "set_checklist":
      return `Set checklist on "${params.node_id}" (${(params.items as unknown[]).length} items)`;
    case "add_checklist_items":
      return `Add ${(params.items as unknown[]).length} item(s) to "${params.node_id}"`;
    case "update_checklist_item":
      return `Mark "${params.item_text}" ${params.checked ? "✓ done" : "○ undone"} on "${params.node_id}"`;
    default:
      return `${action}`;
  }
}
