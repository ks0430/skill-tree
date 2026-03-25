import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// OpenClaw gateway config (read from env or defaults)
const OPENCLAW_URL = process.env.OPENCLAW_GATEWAY_URL || "http://localhost:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || "testopenclaw12345!";

// Cron job IDs from bot-config (hardcoded; update if bot-config changes)
const CRON_JOB_IDS = [
  "1b82eb23-e57d-4213-a88c-2d1be114e863", // pm_cycle
  "a7063094-5568-4ba3-9f3e-6df88a91a1ac", // coding_cycle
];

async function cronUpdate(jobId: string, enabled: boolean) {
  const res = await fetch(`${OPENCLAW_URL}/tools/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
    },
    body: JSON.stringify({
      tool: "cron",
      args: {
        action: "update",
        jobId,
        patch: { enabled },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cron update failed for ${jobId}: ${res.status} ${text}`);
  }
  return res.json();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { action } = await request.json();

  if (action !== "pause" && action !== "resume") {
    return new Response("Invalid action. Use 'pause' or 'resume'.", { status: 400 });
  }

  const enabled = action === "resume";

  const errors: string[] = [];
  for (const jobId of CRON_JOB_IDS) {
    try {
      await cronUpdate(jobId, enabled);
    } catch (e) {
      errors.push(String(e));
    }
  }

  if (errors.length > 0) {
    return Response.json(
      { success: false, errors },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    action,
    message: action === "pause"
      ? "PM cron jobs paused. No new tickets will be picked up."
      : "PM cron jobs resumed. Ticket processing will continue.",
  });
}
