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
    case "update_node": {
      const parts: string[] = [];
      if (params.label !== undefined) parts.push(`label: "${params.label}"`);
      if (params.description !== undefined) parts.push("description");
      if (params.role !== undefined) parts.push(`role: ${params.role}`);
      if (params.parent_id !== undefined) parts.push(`parent: ${params.parent_id ?? "none"}`);
      return `Update "${params.id}"${parts.length ? `: ${parts.join(", ")}` : ""}`;
    }
    case "set_checklist":
      return `Set checklist on "${params.node_id}" (${(params.items as unknown[]).length} items)`;
    case "add_checklist_items":
      return `Add ${(params.items as unknown[]).length} item(s) to "${params.node_id}"`;
    case "update_checklist_item":
      return `Mark "${params.item_text}" ${params.checked ? "✓ done" : "○ undone"} on "${params.node_id}"`;
    case "update_content": {
      const parts: string[] = [];
      if (params.checklist) parts.push(`checklist (${(params.checklist as { action: string }).action})`);
      if (params.note) parts.push(`note (${(params.note as { action: string }).action})`);
      return `Update content on "${params.node_id}": ${parts.join(" + ") || "no-op"}`;
    }
    case "add_edge": {
      const edgeLabel = params.label ? ` ("${params.label}")` : "";
      return `Add ${params.type} edge${edgeLabel}: "${params.source_id}" → "${params.target_id}"`;
    }
    case "remove_edge":
      return `Remove edge "${params.id}"`;
    case "manage_relationship": {
      if (params.action === "remove") return `Remove relationship "${params.id}"`;
      const relLabel = params.label ? ` ("${params.label}")` : "";
      return `Add ${params.type} relationship${relLabel}: "${params.source_id}" → "${params.target_id}"`;
    }
    case "update_properties": {
      const parts: string[] = [];
      if (params.due_date !== undefined) parts.push(`due_date: ${params.due_date ?? "cleared"}`);
      if (params.assignee !== undefined) parts.push(`assignee: ${params.assignee ?? "cleared"}`);
      if (params.priority !== undefined) parts.push(`priority: ${params.priority}`);
      if (params.status !== undefined) parts.push(`status: ${params.status}`);
      return `Update properties on "${params.node_id}": ${parts.join(", ") || "no-op"}`;
    }
    case "set_properties": {
      const props = (params.properties ?? {}) as Record<string, unknown>;
      const parts = Object.entries(props).map(([k, v]) => `${k}: ${v}`);
      return `Set properties on "${params.node_id}": ${parts.join(", ") || "no-op"}`;
    }
    default:
      return `${action}`;
  }
}
