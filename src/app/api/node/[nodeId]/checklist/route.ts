import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { ChecklistItem } from "@/types/node-content";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  const { treeId } = await req.json();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Fetch node — composite PK requires both id + tree_id
  const { data: node } = await supabase
    .from("skill_nodes")
    .select("label, description")
    .eq("id", nodeId)
    .eq("tree_id", treeId)
    .single();

  if (!node) return new Response("Node not found", { status: 404 });

  const anthropic = new Anthropic();

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: `You generate concise, actionable learning checklists.
Return ONLY valid JSON: an array of 4-6 strings, each a short actionable task (max 10 words).
No markdown, no explanation, just the JSON array.`,
      messages: [
        {
          role: "user",
          content: `Generate a checklist for learning: "${node.label}"\nContext: ${node.description ?? "No description provided."}`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const texts: string[] = JSON.parse(raw);
    const items: ChecklistItem[] = texts.map((text, i) => ({
      id: Math.random().toString(36).slice(2, 10) + i,
      text,
      checked: false,
      ai_generated: true,
    }));

    return Response.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[checklist route]", msg);
    return new Response(msg, { status: 500 });
  }
}
