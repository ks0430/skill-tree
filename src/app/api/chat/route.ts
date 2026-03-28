// ITEM-156: workflow smoke test
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { buildTools } from "@/lib/ai/tools";
import { parseContent } from "@/lib/content/checklist";
import type { SkillNode, TreeSchema } from "@/types/skill-tree";
import { resolveSchema } from "@/types/skill-tree";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { treeId, message } = await request.json();

  if (!treeId || !message) {
    return new Response("Missing treeId or message", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Load tree data
  const [treeRes, nodesRes, edgesRes, messagesRes] = await Promise.all([
    supabase.from("skill_trees").select("*").eq("id", treeId).single(),
    supabase.from("skill_nodes").select("*").eq("tree_id", treeId),
    supabase.from("skill_edges").select("*").eq("tree_id", treeId),
    supabase
      .from("chat_messages")
      .select("*")
      .eq("tree_id", treeId)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  if (!treeRes.data) {
    return new Response("Tree not found", { status: 404 });
  }

  const nodes: SkillNode[] = (nodesRes.data ?? []).map((n) => ({
    ...n,
    content: parseContent(n.content ?? { blocks: [] }),
  }));
  const treeSchema = resolveSchema(treeRes.data);
  const systemPrompt = buildSystemPrompt(treeRes.data.name, nodes, edgesRes.data ?? [], treeSchema);

  // Build conversation history
  const history = (messagesRes.data ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: message });

  // Save user message
  await supabase.from("chat_messages").insert({
    tree_id: treeId,
    role: "user",
    content: message,
  });

  const anthropic = new Anthropic();

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: history,
          tools: buildTools(treeSchema),
          stream: true,
        });

        let fullContent = "";
        const toolCalls: Array<{ id: string; name: string; input: string }> = [];
        let currentToolId = "";
        let currentToolName = "";
        let currentToolInput = "";

        for await (const event of response) {
          if (event.type === "content_block_start") {
            if (event.content_block.type === "text") {
              // text block starting
            } else if (event.content_block.type === "tool_use") {
              currentToolId = event.content_block.id;
              currentToolName = event.content_block.name;
              currentToolInput = "";
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              fullContent += event.delta.text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", data: event.delta.text })}\n\n`
                )
              );
            } else if (event.delta.type === "input_json_delta") {
              currentToolInput += event.delta.partial_json;
            }
          } else if (event.type === "content_block_stop") {
            if (currentToolName) {
              const parsedInput = JSON.parse(currentToolInput || "{}");
              toolCalls.push({ id: currentToolId, name: currentToolName, input: currentToolInput });

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_use",
                    data: {
                      id: currentToolId,
                      name: currentToolName,
                      input: JSON.parse(currentToolInput || "{}"),
                    },
                  })}\n\n`
                )
              );
              currentToolId = "";
              currentToolName = "";
              currentToolInput = "";
            }
          }
        }

        // Save assistant message
        await supabase.from("chat_messages").insert({
          tree_id: treeId,
          role: "assistant",
          content: fullContent,
          tool_calls: toolCalls.length
            ? toolCalls.map((t) => ({
                id: t.id,
                name: t.name,
                input: JSON.parse(t.input || "{}"),
              }))
            : null,
        });

        // Generate follow-up suggestions
        try {
          const suggestionRes = await anthropic.messages.create({
            model: "claude-haiku-4-20250514",
            max_tokens: 200,
            system: `You are a learning assistant. Given the user's message and the assistant's reply, suggest 2-3 short follow-up questions or actions the user might want to do next. Return ONLY a JSON array of strings, e.g. ["Add sub-skills to Python", "Mark HTML as in progress", "Show my learning roadmap"]. Each suggestion should be short (under 8 words) and contextually relevant. No explanation, just the JSON array.`,
            messages: [
              { role: "user", content: `User said: "${message}"\nAssistant replied: "${fullContent.slice(0, 500)}"` },
            ],
          });
          const raw = suggestionRes.content[0].type === "text" ? suggestionRes.content[0].text.trim() : "[]";
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          const suggestions: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
          if (suggestions.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "suggestions", data: suggestions.slice(0, 3) })}\n\n`)
            );
          }
        } catch {
          // suggestions are non-critical, ignore errors
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", data: errMsg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
