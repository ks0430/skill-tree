#!/usr/bin/env python3
"""
PM Commands — Telegram /pm command handler.

Polls the Telegram group for new /pm messages and handles them.

Commands:
    /pm status    — show active ticket, progress, next 3 pending
    /pm pause     — disable PM cron job
    /pm resume    — enable PM cron job
    /pm next      — skip current ticket (set to locked, pick next on next cycle)
    /pm priority ITEM-NNN — move item to top of queue (priority 1)

Usage:
    pm_commands.py --config <path-to-bot-config.json>

State: Last processed update_id stored in pm/pm_commands_state.json
"""

import sys
import json
import os
import argparse
import urllib.request
import urllib.parse
import subprocess
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────

def load_json(path):
    with open(path) as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def utcnow():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_headers(key):
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def sb_get(url, key, params=None):
    full = url + ("?" + urllib.parse.urlencode(params) if params else "")
    req = urllib.request.Request(full, headers=sb_headers(key))
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def sb_patch(url, key, data):
    payload = json.dumps(data).encode()
    headers = {**sb_headers(key), "Prefer": "return=minimal"}
    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
    try:
        urllib.request.urlopen(req)
        return True
    except Exception as e:
        print(f"  WARN sb_patch: {e}", file=sys.stderr)
        return False

def get_in_progress(base_url, key, tree_id):
    nodes = sb_get(f"{base_url}/rest/v1/skill_nodes", key, {
        "tree_id": f"eq.{tree_id}",
        "type": "eq.planet",
        "status": "eq.in_progress",
        "select": "*",
        "limit": "1"
    })
    return nodes[0] if nodes else None

def get_next_locked_n(base_url, key, tree_id, n=3):
    return sb_get(f"{base_url}/rest/v1/skill_nodes", key, {
        "tree_id": f"eq.{tree_id}",
        "type": "eq.planet",
        "status": "eq.locked",
        "select": "*",
        "order": "priority.asc",
        "limit": str(n)
    })

def get_all_planets(base_url, key, tree_id):
    return sb_get(f"{base_url}/rest/v1/skill_nodes", key, {
        "tree_id": f"eq.{tree_id}",
        "type": "eq.planet",
        "select": "id,status,priority,label"
    })

def get_node_by_item_id(base_url, key, tree_id, item_id):
    """Find a node where properties->item_id matches, or id matches."""
    # Try by id directly (e.g. item-145)
    nodes = sb_get(f"{base_url}/rest/v1/skill_nodes", key, {
        "tree_id": f"eq.{tree_id}",
        "id": f"eq.{item_id.lower()}",
        "select": "*"
    })
    if nodes:
        return nodes[0]
    return None

def set_node_priority(base_url, key, tree_id, node_id, priority):
    url = f"{base_url}/rest/v1/skill_nodes?id=eq.{node_id}&tree_id=eq.{tree_id}"
    return sb_patch(url, key, {"priority": priority})

def set_node_status(base_url, key, tree_id, node_id, status):
    icon = {"completed": "✅", "in_progress": "⚙️", "locked": "🔒"}.get(status, "🔒")
    url = f"{base_url}/rest/v1/skill_nodes?id=eq.{node_id}&tree_id=eq.{tree_id}"
    return sb_patch(url, key, {"status": status, "icon": icon})

# ── OpenClaw cron helpers ─────────────────────────────────────────────────────

def openclaw_cron_toggle(hooks_url, hooks_token, job_id, enabled):
    """Enable or disable an OpenClaw cron job via the hooks API."""
    url = f"{hooks_url}/cron/jobs/{job_id}"
    payload = json.dumps({"enabled": enabled}).encode()
    headers = {
        "Authorization": f"Bearer {hooks_token}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
    try:
        resp = urllib.request.urlopen(req)
        return True, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return False, body
    except Exception as e:
        return False, str(e)

# ── Telegram helpers ──────────────────────────────────────────────────────────

def post_telegram(token, group_id, text):
    try:
        data = urllib.parse.urlencode({"chat_id": group_id, "text": text}).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data
        )
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"  WARN telegram: {e}", file=sys.stderr)

def get_updates(token, offset=None):
    params = {"timeout": 0, "allowed_updates": '["message"]'}
    if offset is not None:
        params["offset"] = offset
    url = f"https://api.telegram.org/bot{token}/getUpdates?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        data = json.loads(resp.read())
        return data.get("result", [])
    except Exception as e:
        print(f"  WARN getUpdates: {e}", file=sys.stderr)
        return []

# ── Command handlers ──────────────────────────────────────────────────────────

def cmd_status(base_url, key, tree_id):
    active = get_in_progress(base_url, key, tree_id)
    all_planets = get_all_planets(base_url, key, tree_id)

    total = len(all_planets)
    done = sum(1 for n in all_planets if n["status"] == "completed")
    pct = int(done / total * 100) if total else 0

    next_nodes = get_next_locked_n(base_url, key, tree_id, 3)

    lines = ["📊 PM Status"]
    lines.append(f"Progress: {done}/{total} ({pct}%)")

    if active:
        label = active.get("label", active["id"])
        lines.append(f"⚡ Active: {active['id'].upper()} {label}")
    else:
        lines.append("⚡ Active: (none)")

    if next_nodes:
        next_labels = [f"{n['id'].upper()} {n.get('label', '')}" for n in next_nodes]
        lines.append("📋 Next: " + ", ".join(next_labels))
    else:
        lines.append("📋 Next: (queue empty)")

    return "\n".join(lines)

def cmd_pause(config, hooks_url, hooks_token):
    job_id = config.get("cron_jobs", {}).get("pm_cycle", "")
    if not job_id:
        return "❌ pm_cycle cron job ID not found in bot-config.json"
    ok, result = openclaw_cron_toggle(hooks_url, hooks_token, job_id, False)
    if ok:
        return "⏸ PM loop paused. Use /pm resume to restart."
    else:
        return f"❌ Failed to pause: {result}"

def cmd_resume(config, hooks_url, hooks_token):
    job_id = config.get("cron_jobs", {}).get("pm_cycle", "")
    if not job_id:
        return "❌ pm_cycle cron job ID not found in bot-config.json"
    ok, result = openclaw_cron_toggle(hooks_url, hooks_token, job_id, True)
    if ok:
        return "▶️ PM loop resumed."
    else:
        return f"❌ Failed to resume: {result}"

def cmd_next(base_url, key, tree_id):
    active = get_in_progress(base_url, key, tree_id)
    if not active:
        return "ℹ️ No active ticket to skip."
    label = active.get("label", active["id"])
    set_node_status(base_url, key, tree_id, active["id"], "locked")
    return f"⏭ Skipped {active['id'].upper()} ({label}). Setting back to locked — PM will pick next on next cycle."

def cmd_priority(base_url, key, tree_id, item_arg):
    if not item_arg:
        return "❌ Usage: /pm priority ITEM-NNN"

    item_id = item_arg.strip().lower()
    # Normalize: accept "145", "item-145", "ITEM-145"
    if not item_id.startswith("item-"):
        item_id = f"item-{item_id}"

    node = get_node_by_item_id(base_url, key, tree_id, item_id)
    if not node:
        return f"❌ Node {item_id.upper()} not found."

    if node["status"] == "completed":
        return f"❌ {item_id.upper()} is already completed."

    # Get current minimum priority to set this one above it
    # Priority 0 = highest. Set to 0 to put at top, bump all others.
    all_locked = get_next_locked_n(base_url, key, tree_id, 100)
    # Move to priority 0 (highest)
    set_node_priority(base_url, key, tree_id, node["id"], 0)

    label = node.get("label", node["id"])
    return f"🔝 {item_id.upper()} ({label}) moved to top of queue."

# ── State ─────────────────────────────────────────────────────────────────────

def get_state_path(config_path):
    """State file lives next to bot-config.json."""
    return os.path.join(os.path.dirname(config_path), "pm_commands_state.json")

def load_state(state_path):
    if os.path.exists(state_path):
        try:
            return load_json(state_path)
        except Exception:
            pass
    return {"last_update_id": None}

def save_state(state_path, state):
    save_json(state_path, state)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PM Commands — Telegram /pm handler")
    parser.add_argument("--config", required=True, help="Path to pm/bot-config.json")
    args = parser.parse_args()

    config = load_json(args.config)

    sf = config.get("skillforge", {})
    base_url = sf.get("supabase_url", "")
    key = sf.get("service_key", "")
    tree_id = sf.get("tree_id", "")

    group_id = config.get("telegram_group_id", "")
    hooks_url = config.get("openclaw_hooks_url", "http://localhost:18789")
    hooks_token = config.get("openclaw_hooks_token", "")

    # Load PM bot token
    pm_token = ""
    try:
        oc = load_json(os.path.expanduser("~/.openclaw/openclaw.json"))
        accounts = oc.get("channels", {}).get("telegram", {}).get("accounts", {})
        pm_token = accounts.get(config.get("pm_account", "pm"), {}).get("botToken", "")
    except Exception:
        pass

    if not pm_token:
        print("ERROR: PM bot token not found", file=sys.stderr)
        sys.exit(1)

    if not (base_url and key and tree_id):
        print("ERROR: skillforge config missing in bot-config.json", file=sys.stderr)
        sys.exit(1)

    state_path = get_state_path(args.config)
    state = load_state(state_path)
    last_id = state.get("last_update_id")

    # Fetch new updates
    offset = (last_id + 1) if last_id is not None else None
    updates = get_updates(pm_token, offset)

    if not updates:
        print("No new updates.")
        return

    new_last_id = last_id
    for update in updates:
        update_id = update.get("update_id", 0)
        if new_last_id is None or update_id > new_last_id:
            new_last_id = update_id

        msg = update.get("message", {})
        text = msg.get("text", "").strip()
        chat_id = str(msg.get("chat", {}).get("id", ""))

        # Only handle messages from our group
        if chat_id != str(group_id):
            print(f"  Ignoring message from chat {chat_id}")
            continue

        # Only handle /pm commands
        if not text.lower().startswith("/pm"):
            continue

        parts = text.split()
        if len(parts) < 2:
            reply = "❓ Usage: /pm status | pause | resume | next | priority ITEM-NNN"
        else:
            subcmd = parts[1].lower()
            if subcmd == "status":
                reply = cmd_status(base_url, key, tree_id)
            elif subcmd == "pause":
                reply = cmd_pause(config, hooks_url, hooks_token)
            elif subcmd == "resume":
                reply = cmd_resume(config, hooks_url, hooks_token)
            elif subcmd == "next":
                reply = cmd_next(base_url, key, tree_id)
            elif subcmd == "priority":
                item_arg = parts[2] if len(parts) > 2 else ""
                reply = cmd_priority(base_url, key, tree_id, item_arg)
            else:
                reply = f"❓ Unknown command: {subcmd}\nUsage: /pm status | pause | resume | next | priority ITEM-NNN"

        print(f"  Handling: {text!r} → {reply[:60]}...")
        post_telegram(pm_token, group_id, reply)

    # Save state
    if new_last_id is not None:
        state["last_update_id"] = new_last_id
        save_state(state_path, state)
        print(f"Processed up to update_id {new_last_id}")

if __name__ == "__main__":
    main()
