"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AgentEvent {
  id: string;
  event_type: "started" | "progress" | "completed" | "error" | "commit";
  message: string | null;
  agent_id: string | null;
  created_at: string;
}

const eventIcon: Record<AgentEvent["event_type"], string> = {
  started:   "▶",
  progress:  "·",
  completed: "✓",
  error:     "✕",
  commit:    "⎇",
};

const eventColor: Record<AgentEvent["event_type"], string> = {
  started:   "text-sky-400",
  progress:  "text-slate-400",
  completed: "text-emerald-400",
  error:     "text-red-400",
  commit:    "text-violet-400",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day:   "numeric",
    hour:  "2-digit",
    minute: "2-digit",
  });
}

interface PanelHistoryProps {
  nodeId: string;
  treeId: string;
}

export function PanelHistory({ nodeId, treeId }: PanelHistoryProps) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const { data } = await supabase
        .from("agent_events")
        .select("id, event_type, message, agent_id, created_at")
        .eq("tree_id", treeId)
        .eq("node_id", nodeId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!cancelled) {
        setEvents((data as AgentEvent[]) ?? []);
        setLoading(false);
      }
    }

    fetchEvents();

    // Realtime subscription for live updates
    const channel = supabase
      .channel(`agent_events:${nodeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_events",
          filter: `node_id=eq.${nodeId}`,
        },
        (payload) => {
          if (!cancelled) {
            setEvents((prev) => [payload.new as AgentEvent, ...prev.slice(0, 19)]);
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [nodeId, treeId, supabase]);

  if (loading) {
    return (
      <div className="mt-4 pt-3 border-t border-white/10">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">History</p>
        <p className="text-[11px] text-slate-600">Loading…</p>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-white/10">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">History</p>
      <ul className="space-y-2">
        {events.map((ev) => (
          <li key={ev.id} className="flex gap-2 items-start">
            <span className={`text-[11px] font-mono mt-0.5 ${eventColor[ev.event_type]}`}>
              {eventIcon[ev.event_type]}
            </span>
            <div className="flex-1 min-w-0">
              {ev.message && (
                <p className="text-[11px] text-slate-300 leading-snug break-words">{ev.message}</p>
              )}
              <p className="text-[10px] text-slate-600 mt-0.5">{formatTime(ev.created_at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
