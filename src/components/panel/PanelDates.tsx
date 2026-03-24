"use client";

import { useState } from "react";

interface PanelDatesProps {
  dueDate?: string | null;
  startDate?: string | null;
  estimate?: string | null;
  readOnly?: boolean;
  onChange?: (field: "due_date" | "start_date" | "estimate", value: string | null) => void;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  // If already YYYY-MM-DD just return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

function displayDate(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = formatDate(value);
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface FieldProps {
  label: string;
  value: string | null | undefined;
  field: "due_date" | "start_date" | "estimate";
  readOnly: boolean;
  isDate: boolean;
  onChange?: (field: "due_date" | "start_date" | "estimate", value: string | null) => void;
}

function DateField({ label, value, field, readOnly, isDate, onChange }: FieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    if (readOnly) return;
    setDraft(isDate ? (formatDate(value) ?? "") : (value ?? ""));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    onChange?.(field, trimmed || null);
  };

  const cancel = () => setEditing(false);

  const displayValue = isDate ? displayDate(value) : (value || "—");

  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-slate-500 font-mono w-16 shrink-0">{label}</span>
      {editing ? (
        <input
          autoFocus
          type={isDate ? "date" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="flex-1 bg-slate-800 text-white text-[11px] font-mono rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-slate-400"
        />
      ) : (
        <button
          onClick={startEdit}
          disabled={readOnly}
          className={`flex-1 text-right font-mono transition-colors ${
            readOnly
              ? "text-slate-400 cursor-default"
              : "text-slate-300 hover:text-white cursor-pointer"
          }`}
          title={readOnly ? undefined : `Click to edit ${label}`}
        >
          {displayValue}
        </button>
      )}
    </div>
  );
}

export function PanelDates({ dueDate, startDate, estimate, readOnly = false, onChange }: PanelDatesProps) {
  const hasAny = dueDate || startDate || estimate;

  if (readOnly && !hasAny) return null;

  return (
    <div className="mt-3 border-t border-slate-800 pt-3 space-y-1.5">
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Dates</p>
      <DateField
        label="Start"
        value={startDate}
        field="start_date"
        readOnly={readOnly}
        isDate
        onChange={onChange}
      />
      <DateField
        label="Due"
        value={dueDate}
        field="due_date"
        readOnly={readOnly}
        isDate
        onChange={onChange}
      />
      <DateField
        label="Est."
        value={estimate}
        field="estimate"
        readOnly={readOnly}
        isDate={false}
        onChange={onChange}
      />
    </div>
  );
}
