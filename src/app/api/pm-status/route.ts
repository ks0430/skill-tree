import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface SkillNode {
  id: string;
  label: string;
  status: string;
  priority: number;
  type?: string;
  role?: string;
  parent_id?: string | null;
  properties?: Record<string, unknown>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const treeId = searchParams.get("treeId");

  if (!treeId) {
    return new Response("Missing treeId", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: nodes, error } = await supabase
    .from("skill_nodes")
    .select("id, label, status, priority, type, role, parent_id, properties")
    .eq("tree_id", treeId);

  if (error) {
    return new Response("Failed to fetch nodes", { status: 500 });
  }

  const allNodes: SkillNode[] = nodes ?? [];

  const planetNodes = allNodes.filter(
    (n) => (n.type ?? n.role) === "planet"
  );

  const total = planetNodes.length;
  const completed = planetNodes.filter((n) => n.status === "completed").length;
  const inProgress = planetNodes.filter((n) => n.status === "in_progress");
  const pending = planetNodes.filter((n) => n.status === "locked");

  // Sort pending by priority descending (higher priority = more important)
  const sortedPending = [...pending].sort((a, b) => b.priority - a.priority);
  const next3 = sortedPending.slice(0, 3);

  const activeTicket = inProgress.length > 0 ? inProgress[0] : null;

  return Response.json({
    total,
    completed,
    inProgress: activeTicket
      ? { id: activeTicket.id, label: activeTicket.label }
      : null,
    next3: next3.map((n) => ({ id: n.id, label: n.label, priority: n.priority })),
    percentDone: total > 0 ? Math.round((completed / total) * 100) : 0,
  });
}
