#!/usr/bin/env python3
"""
Import SkillForge roadmap into SkillForge as real nodes.

Creates:
  - 1 skill_tree: "SkillForge Dev"
  - 1 stellar node per Phase
  - 1 planet node per ITEM, orbiting its phase stellar
  - depends_on edges for known dependencies
  - status: completed/in_progress/locked based on roadmap checkboxes + pm/state.json

Usage:
    python3 pm/import_roadmap.py
"""

import re
import json
import uuid
import os
import urllib.request
import urllib.parse

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = "https://cnanilxkafouncbigbnn.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYW5pbHhrYWZvdW5jYmlnYm5uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDE4NDY4NSwiZXhwIjoyMDg5NzYwNjg1fQ.jWBdlk7NdfTIkDUEFeyhazl_IAZSOYstNduTuF3XAa8"
USER_ID = "63a9623b-180d-4433-9994-014842aab44b"

ROADMAP_PATH = os.path.join(os.path.dirname(__file__), "archive", "roadmap.md")
STATE_PATH   = None  # state now lives in Supabase
TICKETS_DIR  = None  # tickets now live in Supabase

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Phase colour palette (for icon field — used as accent in future renderers)
PHASE_ICONS = ["⭐", "🌲", "📅", "🕸️", "🧠"]

# Known dependency edges: item_id → [item_ids it depends on]
DEPENDENCIES = {
    "ITEM-024": ["ITEM-023"],
    "ITEM-025": ["ITEM-024"],
    "ITEM-026": ["ITEM-023"],
    "ITEM-027": ["ITEM-025", "ITEM-026"],
    "ITEM-028": ["ITEM-023"],
    "ITEM-029": ["ITEM-028"],
    "ITEM-030": ["ITEM-029"],
    "ITEM-031": ["ITEM-030"],
    "ITEM-032": ["ITEM-025", "ITEM-030"],
    "ITEM-033": ["ITEM-031"],
    "ITEM-034": ["ITEM-029"],
    "ITEM-035": ["ITEM-026"],
    "ITEM-036": ["ITEM-035", "ITEM-025"],
    "ITEM-037": ["ITEM-036"],
    "ITEM-038": ["ITEM-025", "ITEM-036"],
    "ITEM-039": ["ITEM-037"],
    "ITEM-040": ["ITEM-034", "ITEM-039"],
    "ITEM-041": ["ITEM-025"],
    "ITEM-042": ["ITEM-041"],
    "ITEM-043": ["ITEM-041"],
    "ITEM-044": ["ITEM-034", "ITEM-043"],
    "ITEM-045": ["ITEM-041"],
    "ITEM-046": ["ITEM-045"],
    "ITEM-047": ["ITEM-025"],
    "ITEM-048": ["ITEM-034", "ITEM-046"],
}

# ── Supabase helpers ──────────────────────────────────────────────────────────

def sb_post(path, data):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers=HEADERS, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR POST {path}: {e.code} {err[:200]}")
        return None

def sb_get(path, params=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

def sb_delete(path, params):
    url = f"{SUPABASE_URL}/rest/v1/{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS, method="DELETE")
    try:
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"  WARN DELETE {path}: {e}")

# ── Roadmap parser ────────────────────────────────────────────────────────────

def parse_roadmap(path):
    phases = []
    current_phase = None

    phase_counter = 0
    with open(path) as f:
        for line in f:
            # Phase heading — match "## Phase N:", "## Phase 5c:", "## Phase 12: Title" etc.
            m = re.match(r'^##\s+Phase\s+([\w]+):\s+(.+)', line)
            if m:
                phase_counter += 1
                current_phase = {
                    "number": phase_counter,
                    "title": m.group(2).strip().split('(')[0].strip(),  # strip trailing notes
                    "items": []
                }
                phases.append(current_phase)
                continue

            # Item line: - [x] or - [ ]
            if current_phase:
                m = re.match(r'\s*-\s*\[(x| )\]\s*(ITEM-\d+):\s*(.+?)\s*(?:—|-)\s*(.+)', line)
                if m:
                    current_phase["items"].append({
                        "id": m.group(2),
                        "done": m.group(1) == "x",
                        "title": m.group(3).strip(),
                        "description": m.group(4).strip(),
                    })

    return phases

# ── Determine current ticket status ──────────────────────────────────────────

def get_active_item(bot_config):
    """Return ITEM-id of the currently active node from Supabase."""
    try:
        sf = bot_config.get("skillforge", {})
        nodes = sb_get(
            f"{sf['supabase_url']}/rest/v1/skill_nodes",
            sf["service_key"],
            {"tree_id": f"eq.{sf['tree_id']}", "status": "eq.in_progress", "type": "eq.planet", "select": "id,properties", "limit": "1"}
        )
        if nodes:
            props = nodes[0].get("properties") or {}
            return props.get("item_id") or nodes[0]["id"].upper().replace("ITEM-", "ITEM-")
    except Exception:
        pass
    return None

# ── Main import ───────────────────────────────────────────────────────────────

def main():
    print("🚀 SkillForge Dev — Roadmap Import")
    print("=" * 50)

    # Parse roadmap
    phases = parse_roadmap(ROADMAP_PATH)
    bot_config_path = os.path.join(os.path.dirname(__file__), "bot-config.json")
    bot_config_data = json.load(open(bot_config_path)) if os.path.exists(bot_config_path) else {}
    active_item = get_active_item(bot_config_data)
    total_items = sum(len(p["items"]) for p in phases)
    print(f"  Parsed {len(phases)} phases, {total_items} items")
    print(f"  Active item: {active_item or 'none'}")

    # Delete existing "SkillForge Dev" tree if it exists
    existing = sb_get("skill_trees", {"name": "eq.SkillForge Dev", "user_id": f"eq.{USER_ID}", "select": "id"})
    for t in (existing or []):
        print(f"  Removing existing tree {t['id']}...")
        sb_delete("skill_trees", {"id": f"eq.{t['id']}"})

    # Create tree
    print("\n[1/4] Creating skill tree...")
    tree_result = sb_post("skill_trees", {
        "id": str(uuid.uuid4()),
        "user_id": USER_ID,
        "name": "SkillForge Dev",
        "description": "SkillForge development roadmap — phases, items, dependencies. Managed by the PM loop.",
        "theme": "game"
    })
    if not tree_result:
        print("Failed to create tree. Aborting.")
        return
    tree_id = tree_result[0]["id"]
    print(f"  Tree created: {tree_id}")

    # Create stellar nodes (one per phase)
    print("\n[2/4] Creating phase nodes (stellars)...")
    phase_node_ids = {}  # phase_number → node_id
    stellar_nodes = []

    for i, phase in enumerate(phases):
        node_id = f"phase-{phase['number']}-{i}"
        done_count = sum(1 for item in phase["items"] if item["done"])
        total_count = len(phase["items"])
        status = "completed" if done_count == total_count and total_count > 0 else \
                 "in_progress" if done_count > 0 else "locked"
        icon = PHASE_ICONS[i % len(PHASE_ICONS)]

        stellar_nodes.append({
            "id": node_id,
            "tree_id": tree_id,
            "label": f"Phase {phase['number']}: {phase['title']}",
            "description": f"{done_count}/{total_count} items complete",
            "status": status,
            "role": "stellar",
            "type": "stellar",
            "parent_id": None,
            "priority": 5,
            "position_x": i * 10.0,
            "position_y": 0.0,
            "icon": icon,
            "properties": {"phase_number": phase["number"], "done": done_count, "total": total_count},
            "content": {"blocks": []}
        })
        phase_node_ids[phase["number"]] = node_id
        print(f"  Phase {phase['number']}: {phase['title']} [{status}]")

    sb_post("skill_nodes", stellar_nodes)

    # Create planet nodes (one per item)
    print("\n[3/4] Creating item nodes (planets)...")
    planet_nodes = []
    item_node_ids = {}  # ITEM-NNN → node_id

    for phase in phases:
        parent_id = phase_node_ids[phase["number"]]
        for j, item in enumerate(phase["items"]):
            node_id = item["id"].lower()  # e.g. "item-023"
            item_node_ids[item["id"]] = node_id

            if item["done"]:
                status = "completed"
            elif item["id"] == active_item:
                status = "in_progress"
            else:
                # Check if all dependencies are done
                deps = DEPENDENCIES.get(item["id"], [])
                all_deps_done = all(
                    any(it["id"] == dep and it["done"] for p in phases for it in p["items"])
                    for dep in deps
                )
                status = "locked" if (deps and not all_deps_done) else "locked"
                # Items with no deps that aren't done are available (locked = not started)

            planet_nodes.append({
                "id": node_id,
                "tree_id": tree_id,
                "label": f"{item['id']}: {item['title']}",
                "description": item["description"],
                "status": status,
                "role": "planet",
                "type": "planet",
                "parent_id": parent_id,
                "priority": 3,
                "position_x": j * 2.0,
                "position_y": 0.0,
                "icon": "✅" if item["done"] else ("⚙️" if item["id"] == active_item else "🔒"),
                "properties": {
                    "item_id": item["id"],
                    "phase": phase["number"],
                },
                "content": {"blocks": []}
            })

        print(f"  Phase {phase['number']}: {len(phase['items'])} items queued")

    # Insert in batches of 20
    for i in range(0, len(planet_nodes), 20):
        batch = planet_nodes[i:i+20]
        sb_post("skill_nodes", batch)
    print(f"  {len(planet_nodes)} item nodes created")

    # Create dependency edges
    print("\n[4/4] Creating dependency edges...")
    edges = []
    for item_id, dep_ids in DEPENDENCIES.items():
        target_node = item_id.lower()
        for dep_id in dep_ids:
            source_node = dep_id.lower()
            edges.append({
                "id": f"edge-dep-{dep_id.lower()}-{item_id.lower()}",
                "tree_id": tree_id,
                "source_id": source_node,
                "target_id": target_node,
                "label": "depends_on",
                "type": "depends_on",
                "weight": 1.0
            })

    for i in range(0, len(edges), 20):
        sb_post("skill_edges", edges[i:i+20])
    print(f"  {len(edges)} dependency edges created")

    print(f"\n✅ Import complete!")
    print(f"  Tree ID: {tree_id}")
    print(f"  Open SkillForge and look for 'SkillForge Dev' in your dashboard")
    print(f"  URL: http://52.63.157.41:3000")

if __name__ == "__main__":
    main()
