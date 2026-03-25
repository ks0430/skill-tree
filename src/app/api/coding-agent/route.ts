import { exec } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";

const execAsync = promisify(exec);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENCLAW_HOOKS_URL = process.env.OPENCLAW_HOOKS_URL || "http://localhost:18789";
const OPENCLAW_HOOKS_TOKEN = process.env.OPENCLAW_HOOKS_TOKEN || "";
const WEBHOOK_SECRET = process.env.CODING_AGENT_WEBHOOK_SECRET || "";

interface SkillNode {
  id: string;
  label: string;
  status: string;
  priority: number;
  type?: string;
  role?: string;
  properties?: Record<string, unknown>;
}

async function fetchNode(nodeId: string, treeId: string): Promise<SkillNode | null> {
  const url = `${SUPABASE_URL}/rest/v1/skill_nodes?id=eq.${nodeId}&tree_id=eq.${treeId}&select=id,label,status,priority,type,role,properties`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0] ?? null;
}

function buildEventText(node: SkillNode, treeId: string, itemId: string): string {
  const project = "/home/ubuntu/.openclaw/workspace/project/skillforge";
  const ticket = itemId || node.id;

  // Build the system event text that will be injected into the coding session
  return `Task: CodingAgent:${node.id} | Job ID: ${ticket} | Received: ${new Date().toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC

You are Crow, a coding agent. A ticket has been activated.

**Project:** ${project}
**Node ID:** ${node.id}
**Ticket:** ${ticket}: ${node.label}

**What to build:**
${(node.properties?.description as string) || node.label}

**First — check if already done:**
Check git log and codebase. If already implemented, run done curl and exit.

**Heartbeat — run every few steps so PM knows you are alive:**
  curl -s -X PATCH '${SUPABASE_URL}/rest/v1/skill_nodes?id=eq.${node.id}&tree_id=eq.${treeId}' -H 'apikey: ${SUPABASE_SERVICE_KEY}' -H 'Content-Type: application/json' -d '{"properties": {"heartbeat_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "node_id": "${node.id}"}}'

**Progress to Telegram:**
  curl -s -X POST 'https://api.telegram.org/bot8674102272:AAHqrHHlLHuM3Cqh2vYu9nOgMI_swa1l0WA/sendMessage' --data-urlencode 'chat_id=-1003778286925' --data-urlencode 'text=MESSAGE'
  - Exploring: '🔍 ${ticket}: [what you found]'
  - Implementing: '⚙️ ${ticket}: [plan]'
  - Committed: '📦 ${ticket}: Committed — [hash]'

**Implement:**
1. Explore project structure
2. Implement the change cleanly
3. git add -A && git commit -m "${ticket}: ${node.label}"
4. git push

**Mark done immediately after commit:**
  curl -s -X PATCH '${SUPABASE_URL}/rest/v1/skill_nodes?id=eq.${node.id}&tree_id=eq.${treeId}' -H 'apikey: ${SUPABASE_SERVICE_KEY}' -H 'Content-Type: application/json' -d '{"status": "completed", "icon": "done"}'

5. Post: '✅ ${ticket} done — [one plain English sentence]'

Keep change focused. Do not start next ticket.`;
}

export async function POST(request: Request) {
  // Optional shared-secret auth
  if (WEBHOOK_SECRET) {
    const authHeader = request.headers.get("x-webhook-secret") || request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (token !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { node_id, tree_id, item_id } = body;
  if (!node_id || !tree_id) {
    return new Response("Missing node_id or tree_id", { status: 400 });
  }

  // Look up the ticket from Supabase
  const node = await fetchNode(node_id, tree_id);
  if (!node) {
    return new Response(`Node ${node_id} not found in tree ${tree_id}`, { status: 404 });
  }

  // Build the system event text
  const eventText = buildEventText(node, tree_id, item_id || node_id);

  // Fire the system event via openclaw CLI
  try {
    const tokenFlag = OPENCLAW_HOOKS_TOKEN ? `--token "${OPENCLAW_HOOKS_TOKEN}"` : "";
    const urlFlag = OPENCLAW_HOOKS_URL ? `--url "${OPENCLAW_HOOKS_URL.replace("http", "ws").replace("/18789", ":18789")}"` : "";
    const cmd = `openclaw system event --mode now --text ${JSON.stringify(eventText)} ${tokenFlag}`;
    await execAsync(cmd, { timeout: 15000 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to fire system event:", message);
    return new Response(`Failed to trigger coding agent: ${message}`, { status: 500 });
  }

  return Response.json({
    ok: true,
    node_id,
    tree_id,
    label: node.label,
    triggered_at: new Date().toISOString(),
  });
}
