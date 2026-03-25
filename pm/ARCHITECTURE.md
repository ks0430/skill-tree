# PM Architecture — Phase 22 Design

## Overview

Two independent roles. Supabase is the shared state. Telegram is visibility only.

```
PM cron (every 5 min)          Coding Agent (webhook-triggered)
─────────────────────          ────────────────────────────────
Check Supabase                 Receives webhook POST
  → any in_progress?           → reads ticket from Supabase
    → heartbeat ok? wait       → writes heartbeat
    → heartbeat stale?         → implements ticket
      → re-trigger webhook     → updates heartbeat periodically
  → none in_progress?          → marks node completed
    → pick next locked         → posts ✅ to Telegram
    → set in_progress          → exits
    → POST webhook
    → post 📋 to Telegram
```

---

## PM Cron — `pm_cycle.py` (simplified)

**Inputs:** Supabase `skill_nodes` + `pm/agent-heartbeat.json`
**Output:** Supabase writes + webhook POST + Telegram message

```python
def main():
    # 1. Check for active ticket
    active = query_supabase(status="in_progress", tree_id=...)
    
    if active:
        # Check if agent is alive
        if heartbeat_is_fresh(active.id):
            exit()  # Agent working, nothing to do
        else:
            # Agent died — re-trigger
            post_telegram("⚠️ TICKET-NNN agent stale — re-triggering...")
            trigger_webhook(active)
            exit()
    
    # 2. No active ticket — pick next
    next_node = query_supabase(
        status="locked", type="planet",
        order_by="priority ASC", limit=1
    )
    
    if not next_node:
        post_telegram("🎉 All tickets complete!")
        exit()
    
    # 3. Activate it
    set_status(next_node.id, "in_progress")
    trigger_webhook(next_node)
    post_telegram(f"📋 Picked up {next_node.label} — starting now")
```

---

## Coding Agent — webhook payload

When PM triggers the webhook, it sends:

```json
{
  "tree_id": "...",
  "node_id": "item-061",
  "ticket_id": "TICKET-060",
  "item_id": "ITEM-061"
}
```

Coding agent reads full ticket details from Supabase using `node_id`.

---

## Heartbeat

Coding agent writes `pm/agent-heartbeat.json` at start + every ~10 min:

```json
{
  "ticket": "TICKET-060",
  "node_id": "item-061", 
  "updated_at": "2026-03-25T12:50:00Z"
}
```

PM checks: age < 35 min AND node_id matches current in_progress node → alive.

---

## Telegram messages

| Event | Who posts | Message |
|---|---|---|
| Ticket activated | PM bot | `📋 Picked up ITEM-061: KanbanView fix — starting now` |
| Agent re-triggered | PM bot | `⚠️ TICKET-060 agent stale (45min) — re-triggering` |
| All done | PM bot | `🎉 All tickets complete! Roadmap finished.` |
| Progress | Coding bot | `🔍 ⚙️ 📦` (existing behaviour) |
| Completion | Coding bot | `✅ TICKET-060 done — fixed border conflict in KanbanView.tsx` |

---

## What this removes

- No `state.json` (state is in Supabase)
- No agent spawning from pm_cycle.py
- No roadmap.md as execution driver (changelog only)
- No complex cron message with embedded coding task
- No heartbeat via file system (still a file, but PM just reads it)

## What stays

- `pm/roadmap.md` — write-only changelog
- `pm/tickets/TICKET-NNN.md` — detailed ticket record (until ITEM-064 ships)
- `pm/log.md` — append-only history
- Telegram — visibility only
- pm2 / skillforge server — unchanged
