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

async function getInProgress(treeId: string) {
  const url = `${SUPABASE_URL}/rest/v1/skill_nodes?tree_id=eq.${treeId}&type=eq.planet&status=eq.in_progress&select=*&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

async function getNextLocked(treeId: string) {
  const url = `${SUPABASE_URL}/rest/v1/skill_nodes?tree_id=eq.${treeId}&type=eq.planet&status=eq.locked&select=*&order=priority.asc&limit=1`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
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

  const { treeId } = await request.json();

  if (!treeId) {
    return new Response("Missing treeId", { status: 400 });
  }

  // Find current in_progress ticket
  const active = await getInProgress(treeId);

  if (!active) {
    return Response.json({
      success: false,
      message: "No ticket is currently in progress.",
    }, { status: 404 });
  }

  // Find next locked ticket
  const nextNode = await getNextLocked(treeId);

  // Defer the active ticket: set back to locked with deferred metadata
  const existingProps = (active.properties && typeof active.properties === "object")
    ? active.properties as Record<string, unknown>
    : {};

  await patchNode(treeId, active.id, {
    status: "locked",
    icon: "🔒",
    properties: {
      ...existingProps,
      deferred_at: new Date().toISOString(),
      deferred: true,
    },
  });

  if (!nextNode) {
    return Response.json({
      success: true,
      deferred: { id: active.id, label: active.label },
      advanced: null,
      message: `⏭️ **${active.label}** deferred. No more pending tickets in the queue.`,
    });
  }

  // Advance next ticket to in_progress
  const nextExistingProps = (nextNode.properties && typeof nextNode.properties === "object")
    ? nextNode.properties as Record<string, unknown>
    : {};

  await patchNode(treeId, nextNode.id, {
    status: "in_progress",
    icon: "⚙️",
    properties: {
      ...nextExistingProps,
      activated_at: new Date().toISOString(),
    },
  });

  return Response.json({
    success: true,
    deferred: { id: active.id, label: active.label },
    advanced: { id: nextNode.id, label: nextNode.label },
    message: `⏭️ Skipped **${active.label}** (deferred). Now working on **${nextNode.label}**.`,
  });
}
