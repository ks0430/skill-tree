import type { NodeStatus } from "@/types/skill-tree";

const statusInfo: Partial<Record<NodeStatus, { label: string; bar: string }>> = {
  backlog:     { label: "Backlog", bar: "w-0" },
  queued:      { label: "Queued", bar: "w-1/4" },
  in_progress: { label: "In progress", bar: "w-1/2" },
  completed:   { label: "Fully learned", bar: "w-full" },
};

export function PanelStatus({ status }: { status: NodeStatus }) {
  const { label, bar } = statusInfo[status] ?? { label: status, bar: "w-0" };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
        <span>{label}</span>
        <span>Press Space to advance</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-white/70 transition-all duration-500 ${bar}`} />
      </div>
    </div>
  );
}
