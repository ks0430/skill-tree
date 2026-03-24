import type { NodeRole } from "@/types/skill-tree";

const roleLabels: Record<NodeRole, string> = {
  stellar: "Star System",
  planet: "Planet",
  satellite: "Moon",
};

interface PanelHeaderProps {
  role: NodeRole;
  label: string;
  pinned: boolean;
  onClose?: () => void;
}

export function PanelHeader({ role, label, pinned, onClose }: PanelHeaderProps) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
          {roleLabels[role]}
        </span>
        {pinned && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              Pinned
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-white transition-colors text-xs leading-none"
                title="Unpin (ESC)"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
      <h3 className="font-mono font-bold text-white text-sm mt-0.5">{label}</h3>
    </div>
  );
}
