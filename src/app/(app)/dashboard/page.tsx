"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { SkillTree } from "@/types/skill-tree";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/Spinner";

interface TreeWithProgress extends SkillTree {
  totalNodes: number;
  completedNodes: number;
  inProgressNodes: number;
  stellarCount: number;
}

export default function DashboardPage() {
  const [trees, setTrees] = useState<TreeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadTrees();
  }, []);

  async function loadTrees() {
    const { data: treesData } = await supabase
      .from("skill_trees")
      .select("*")
      .order("updated_at", { ascending: false });

    if (!treesData) {
      setTrees([]);
      setLoading(false);
      return;
    }

    // Load node counts per tree
    const treeIds = treesData.map((t) => t.id);
    const { data: nodesData } = await supabase
      .from("skill_nodes")
      .select("tree_id, status, role")
      .in("tree_id", treeIds);

    const countMap = new Map<string, { total: number; completed: number; inProgress: number; stellars: number }>();
    (nodesData ?? []).forEach((n) => {
      if (!countMap.has(n.tree_id))
        countMap.set(n.tree_id, { total: 0, completed: 0, inProgress: 0, stellars: 0 });
      const c = countMap.get(n.tree_id)!;
      c.total++;
      if (n.status === "completed") c.completed++;
      if (n.status === "in_progress") c.inProgress++;
      if (n.role === "stellar") c.stellars++;
    });

    setTrees(
      treesData.map((t) => {
        const c = countMap.get(t.id) ?? { total: 0, completed: 0, inProgress: 0, stellars: 0 };
        return {
          ...t,
          totalNodes: c.total,
          completedNodes: c.completed,
          inProgressNodes: c.inProgress,
          stellarCount: c.stellars,
        };
      })
    );
    setLoading(false);
  }

  async function createTree() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("skill_trees")
      .insert({ name: newName.trim(), user_id: user.id })
      .select()
      .single();

    if (data) router.push(`/tree/${data.id}`);
    setCreating(false);
  }

  async function deleteTree(id: string) {
    await supabase.from("skill_nodes").delete().eq("tree_id", id);
    await supabase.from("chat_messages").delete().eq("tree_id", id);
    await supabase.from("skill_trees").delete().eq("id", id);
    setTrees((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-mono bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
          SkillForge
        </h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createTree()}
            placeholder="New galaxy name..."
            className="flex-1 px-3 py-2 rounded-lg bg-navy-800 border border-glass-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
          />
          <button
            onClick={createTree}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 rounded-lg bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {creating && <Spinner />}
            {creating ? "Creating..." : "Create Galaxy"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass rounded-xl p-4 animate-pulse">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-700/60 rounded w-1/3" />
                  <div className="h-3 bg-slate-700/40 rounded w-2/3" />
                  <div className="flex gap-4 mt-2">
                    <div className="h-3 bg-slate-700/40 rounded w-16" />
                    <div className="h-3 bg-slate-700/40 rounded w-12" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full" />
                    <div className="h-3 bg-slate-700/40 rounded w-8" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : trees.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          <p className="text-lg mb-2">No galaxies yet</p>
          <p className="text-sm">Create one above and let AI build your star systems!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          <AnimatePresence>
            {trees.map((tree) => {
              const pct = tree.totalNodes > 0 ? Math.round((tree.completedNodes / tree.totalNodes) * 100) : 0;
              return (
                <motion.div
                  key={tree.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="glass rounded-xl p-4 group cursor-pointer hover:border-accent-blue/30 transition-colors"
                  onClick={() => router.push(`/tree/${tree.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{tree.name}</h3>
                      {tree.description && (
                        <p className="text-sm text-slate-400 mt-1">{tree.description}</p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        {tree.stellarCount > 0 && (
                          <span>{tree.stellarCount} star system{tree.stellarCount > 1 ? "s" : ""}</span>
                        )}
                        {tree.totalNodes > 0 && (
                          <span>{tree.totalNodes} nodes</span>
                        )}
                        {tree.inProgressNodes > 0 && (
                          <span className="text-amber-500/70">{tree.inProgressNodes} in progress</span>
                        )}
                        {tree.completedNodes > 0 && (
                          <span className="text-emerald-500/70">{tree.completedNodes} completed</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {tree.totalNodes > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white/50 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-600 w-8 text-right">{pct}%</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTree(tree.id);
                      }}
                      className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-4 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
