"use client";

import type { Node3D } from "@/lib/store/tree-store";
import type { NodeStatus, NodeRole } from "@/types/skill-tree";
import { motion } from "framer-motion";

const statusInfo: Record<NodeStatus, { label: string; bar: string }> = {
  locked: { label: "Not started", bar: "w-0" },
  in_progress: { label: "In progress", bar: "w-1/2" },
  completed: { label: "Fully learned", bar: "w-full" },
};

const roleLabels: Record<NodeRole, string> = {
  stellar: "Star System",
  planet: "Planet",
  satellite: "Moon",
};

export function NodeDetailPanel({ node }: { node: Node3D }) {
  const status = statusInfo[node.data.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.15 }}
      className="absolute top-4 left-4 glass rounded-xl p-4 max-w-xs pointer-events-none z-10"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {roleLabels[node.data.role]}
        </span>
      </div>

      <h3 className="font-mono font-bold text-white text-sm">
        {node.data.label}
      </h3>

      {node.data.description && (
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          {node.data.description}
        </p>
      )}

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
          <span>{status.label}</span>
          <span>Double-click to advance</span>
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-white/70 transition-all duration-500 ${status.bar}`}
          />
        </div>
      </div>
    </motion.div>
  );
}
