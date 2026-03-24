import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Public share endpoint — uses service role to bypass RLS
// Only exposes read-only tree + node data (no user info, no chat)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const [treeRes, nodesRes] = await Promise.all([
    supabase.from("skill_trees").select("id, name, description").eq("id", id).single(),
    supabase
      .from("skill_nodes")
      .select("id, tree_id, label, description, status, role, parent_id, priority, position_x, position_y, icon, content")
      .eq("tree_id", id),
  ]);

  if (treeRes.error || !treeRes.data) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }

  return NextResponse.json({
    tree: treeRes.data,
    nodes: (nodesRes.data ?? []).map((n) => ({
      ...n,
      content: n.content ?? { blocks: [] },
      metadata: null,
    })),
  });
}
