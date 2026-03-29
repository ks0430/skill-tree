"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { SkillTree } from "@/types/skill-tree";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@/components/ui/Spinner";
import { TreeThumbnail } from "@/components/ui/TreeThumbnail";
import { toast } from "sonner";

interface ThumbnailNode {
  id: string;
  type: string;
  parent_id: string | null;
  status: string;
}

interface TreeWithProgress extends SkillTree {
  totalNodes: number;
  completedNodes: number;
  inProgressNodes: number;
  stellarCount: number;
  thumbnailNodes: ThumbnailNode[];
}

export default function DashboardPage() {
  const [trees, setTrees] = useState<TreeWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
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
      .select("id, tree_id, type, parent_id, properties")
      .in("tree_id", treeIds);

    const countMap = new Map<string, { total: number; completed: number; inProgress: number; stellars: number }>();
    const thumbnailMap = new Map<string, ThumbnailNode[]>();
    (nodesData ?? []).forEach((n) => {
      const effectiveType = n.type as string;
      const status = ((n.properties as Record<string, unknown>)?.status as string) ?? "backlog";
      if (!countMap.has(n.tree_id))
        countMap.set(n.tree_id, { total: 0, completed: 0, inProgress: 0, stellars: 0 });
      const c = countMap.get(n.tree_id)!;
      c.total++;
      if (status === "completed") c.completed++;
      if (status === "in_progress") c.inProgress++;
      if (effectiveType === "stellar") c.stellars++;

      // Collect thumbnail nodes (stellar + planet only)
      if (effectiveType === "stellar" || effectiveType === "planet") {
        if (!thumbnailMap.has(n.tree_id)) thumbnailMap.set(n.tree_id, []);
        thumbnailMap.get(n.tree_id)!.push({
          id: n.id,
          type: effectiveType,
          parent_id: n.parent_id,
          status,
        });
      }
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
          thumbnailNodes: thumbnailMap.get(t.id) ?? [],
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

    if (data) {
      toast.success("Galaxy created!");
      router.push(`/tree/${data.id}`);
    } else {
      toast.error("Failed to create galaxy");
    }
    setCreating(false);
  }

  async function deleteTree(id: string) {
    await supabase.from("skill_nodes").delete().eq("tree_id", id);
    await supabase.from("chat_messages").delete().eq("tree_id", id);
    const { error } = await supabase.from("skill_trees").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete galaxy");
    } else {
      setTrees((prev) => prev.filter((t) => t.id !== id));
      toast.success("Galaxy deleted");
    }
  }

  function startRename(tree: TreeWithProgress, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(tree.id);
    setRenameValue(tree.name);
    setTimeout(() => renameInputRef.current?.select(), 30);
  }

  async function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }
    setTrees((prev) => prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)));
    setRenamingId(null);
    const { error } = await supabase.from("skill_trees").update({ name: trimmed }).eq("id", id);
    if (error) toast.error("Failed to rename galaxy");
    else toast.success("Galaxy renamed");
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  async function duplicateTree(tree: TreeWithProgress, e: React.MouseEvent) {
    e.stopPropagation();
    setDuplicatingId(tree.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDuplicatingId(null); return; }

    const { data: newTree } = await supabase
      .from("skill_trees")
      .insert({ name: `Copy of ${tree.name}`, user_id: user.id })
      .select()
      .single();

    if (!newTree) {
      toast.error("Failed to duplicate galaxy");
      setDuplicatingId(null);
      return;
    }

    const { data: nodes } = await supabase
      .from("skill_nodes")
      .select("*")
      .eq("tree_id", tree.id);

    if (nodes && nodes.length > 0) {
      const cloned = nodes.map(({ tree_id: _tid, ...rest }) => ({ ...rest, tree_id: newTree.id }));
      await supabase.from("skill_nodes").insert(cloned);
    }

    setTrees((prev) => [
      {
        ...newTree,
        totalNodes: tree.totalNodes,
        completedNodes: 0,
        inProgressNodes: 0,
        stellarCount: tree.stellarCount,
        thumbnailNodes: tree.thumbnailNodes,
      },
      ...prev,
    ]);
    toast.success("Galaxy duplicated!");
    setDuplicatingId(null);
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/settings")}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Settings
          </button>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
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
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-[120px] h-[76px] bg-slate-800/60 rounded-lg" />
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
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center py-20 px-6"
        >
          {/* Star cluster icon */}
          <div className="text-6xl mb-6 select-none">🌌</div>
          <h2 className="text-2xl font-semibold text-white mb-3">No galaxies yet</h2>
          <p className="text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
            Create your first galaxy and let AI map out your skill universe — star systems, planets, and satellites.
          </p>
          <div className="flex flex-col items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTree()}
              placeholder="Name your first galaxy..."
              className="w-full max-w-xs px-4 py-2.5 rounded-lg bg-navy-800 border border-glass-border text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue text-center"
            />
            <button
              onClick={createTree}
              disabled={creating || !newName.trim()}
              className="px-6 py-2.5 rounded-lg bg-accent-blue text-white font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {creating && <Spinner />}
              {creating ? "Creating..." : "Create Galaxy"}
            </button>
            {/* Example name chips */}
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {["Web Development", "Machine Learning", "System Design", "DevOps"].map((example) => (
                <button
                  key={example}
                  onClick={() => setNewName(example)}
                  className="px-3 py-1 rounded-full text-xs border border-glass-border text-slate-400 hover:text-white hover:border-accent-blue/50 transition-colors bg-navy-800/50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
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
                  <div className="flex items-start gap-4">
                    {/* Thumbnail preview */}
                    <div className="flex-shrink-0 rounded-lg overflow-hidden border border-glass-border/40">
                      <TreeThumbnail
                        treeId={tree.id}
                        nodes={tree.thumbnailNodes}
                        width={120}
                        height={76}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      {renamingId === tree.id ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(tree.id);
                            if (e.key === "Escape") cancelRename();
                          }}
                          onBlur={() => commitRename(tree.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-white bg-navy-800 border border-accent-blue rounded px-2 py-0.5 focus:outline-none w-full max-w-xs"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{tree.name}</h3>
                          <button
                            onClick={(e) => startRename(tree, e)}
                            title="Rename"
                            className="text-slate-600 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
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

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 ml-4">
                      <button
                        onClick={(e) => duplicateTree(tree, e)}
                        disabled={duplicatingId === tree.id}
                        className="text-slate-600 hover:text-accent-blue transition-colors text-sm disabled:opacity-40"
                        title="Duplicate"
                      >
                        {duplicatingId === tree.id ? <Spinner /> : "Duplicate"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(tree.id);
                        }}
                        className="text-slate-600 hover:text-red-400 transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteConfirmId && (() => {
          const tree = trees.find((t) => t.id === deleteConfirmId);
          return (
            <motion.div
              key="delete-confirm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setDeleteConfirmId(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 16 }}
                transition={{ duration: 0.2 }}
                className="glass rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-white mb-2">Delete galaxy?</h3>
                <p className="text-sm text-slate-400 mb-6">
                  <span className="text-white font-medium">{tree?.name}</span> and all its nodes will be permanently deleted. This cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      deleteTree(deleteConfirmId);
                      setDeleteConfirmId(null);
                    }}
                    className="px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-500 transition-colors font-medium"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
