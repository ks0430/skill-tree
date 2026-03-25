import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function sbHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function getNode(treeId: string, nodeId: string) {
  const url = `${SUPABASE_URL}/rest/v1/skill_nodes?id=eq.${nodeId}&tree_id=eq.${treeId}&select=*&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

async function getMinPriority(treeId: string, excludeId: string) {
  const url = `${SUPABASE_URL}/rest/v1/skill_nodes?tree_id=eq.${treeId}&type=eq.planet&status=eq.locked&id=neq.${excludeId}&select=priority&order=priority.asc&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows[0]?.priority ?? null;
}

async function patchNode(treeId: string, nodeId: string, patch: Record<string, unknown>) {
  const url = `${SUPABASE_URL}/rest/v1/skill_nodes?id=eq.${nodeId}&tree_id=eq.${treeId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...sbHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase patch failed for ${nodeId}: ${res.status} ${text}`);
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { treeId, itemId } = await request.json();

  if (!treeId || !itemId) {
    return new Response("Missing treeId or itemId", { status: 400 });
  }

  // Normalize itemId — accept "item-070" or "ITEM-070" or "070"
  const normalizedId = itemId.trim().toLowerCase().startsWith("item-")
    ? itemId.trim().toLowerCase()
    : `item-${itemId.trim().toLowerCase()}`;

  // Fetch the target node
  const node = await getNode(treeId, normalizedId);

  if (!node) {
    return Response.json({
      success: false,
      message: `❌ Item **${normalizedId}** not found in this board.`,
    }, { status: 404 });
  }

  if (node.status === "done") {
    return Response.json({
      success: false,
      message: `❌ **${node.label}** is already done — can't reprioritise.`,
    }, { status: 400 });
  }

  if (node.status === "in_progress") {
    return Response.json({
      success: false,
      message: `⚙️ **${node.label}** is already in progress — it's already running.`,
    }, { status: 400 });
  }

  // Find the current minimum priority among other locked tickets
  const currentMin = await getMinPriority(treeId, normalizedId);
  const newPriority = currentMin !== null && currentMin > 1 ? currentMin - 1 : 1;

  // Set the target ticket to new top priority
  await patchNode(treeId, normalizedId, { priority: newPriority });

  return Response.json({
    success: true,
    item: { id: normalizedId, label: node.label },
    priority: newPriority,
    message: `🔝 **${node.label}** moved to top of queue (priority ${newPriority}).`,
  });
}
