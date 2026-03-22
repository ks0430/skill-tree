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
  const role = params.role as string | undefined;
  const roleTag = role ? `[${role}] ` : "";
  switch (action) {
    case "add_node":
      return `Add ${roleTag}"${params.label}"`;
    case "remove_node":
      return `Remove "${params.id}"`;
    case "update_node":
      return `Update "${params.id}"`;
    default:
      return `${action}`;
  }
}
