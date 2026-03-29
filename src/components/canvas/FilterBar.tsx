"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { TreeSchema, PropertyDef, ViewConfig } from "@/types/skill-tree";

type Filter = NonNullable<ViewConfig["filters"]>[number];

interface FilterBarProps {
  schema: TreeSchema;
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
}

// Property types that are filterable and the control type they map to
type ControlType = "multi-select" | "text" | "date-range";

function controlTypeFor(def: PropertyDef): ControlType | null {
  switch (def.type) {
    case "select":
    case "multi_select":
      return "multi-select";
    case "text":
      return "text";
    case "date":
      return "date-range";
    default:
      return null;
  }
}

/* ── Multi-select dropdown ─────────────────────────────────────────────── */

function MultiSelectFilter({
  property,
  options,
  selected,
  onChange,
}: {
  property: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((v) => v !== opt)
      : [...selected, opt];
    onChange(next);
  }

  const label = property.replace(/_/g, " ");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${
          selected.length > 0
            ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
            : "border-glass-border bg-transparent text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <span className="capitalize">{label}</span>
        {selected.length > 0 && (
          <span className="bg-indigo-500/30 text-indigo-200 text-[10px] px-1.5 rounded-full">
            {selected.length}
          </span>
        )}
        <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[160px] glass rounded-lg overflow-hidden shadow-xl">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                  selected.includes(opt)
                    ? "border-indigo-500 bg-indigo-500/30 text-indigo-200"
                    : "border-slate-600"
                }`}
              >
                {selected.includes(opt) && "✓"}
              </span>
              <span className="text-slate-300 capitalize">{opt.replace(/_/g, " ")}</span>
            </button>
          ))}
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-[10px] text-slate-500 hover:text-white hover:bg-white/5 transition-colors border-t border-glass-border"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Text input filter ─────────────────────────────────────────────────── */

function TextFilter({
  property,
  value,
  onChange,
}: {
  property: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = property.replace(/_/g, " ");

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Filter ${label}...`}
        className="w-32 px-2.5 py-1.5 rounded-lg text-xs bg-transparent border border-glass-border text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-1.5 text-slate-500 hover:text-white text-[10px]"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ── Date range filter ─────────────────────────────────────────────────── */

function DateRangeFilter({
  property,
  from,
  to,
  onChange,
}: {
  property: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const label = property.replace(/_/g, " ");
  const hasValue = from || to;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-slate-500 capitalize">{label}:</span>
      <input
        type="date"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
        className="px-1.5 py-1 rounded-lg text-xs bg-transparent border border-glass-border text-white focus:outline-none focus:border-indigo-500/50 transition-colors [color-scheme:dark]"
      />
      <span className="text-[10px] text-slate-500">–</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
        className="px-1.5 py-1 rounded-lg text-xs bg-transparent border border-glass-border text-white focus:outline-none focus:border-indigo-500/50 transition-colors [color-scheme:dark]"
      />
      {hasValue && (
        <button
          onClick={() => onChange("", "")}
          className="text-slate-500 hover:text-white text-[10px]"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ── Main FilterBar ────────────────────────────────────────────────────── */

export function FilterBar({ schema, filters, onFiltersChange }: FilterBarProps) {
  // Build the list of filterable properties from schema
  const filterableProps = Object.entries(schema.properties).filter(
    ([, def]) => controlTypeFor(def) !== null
  );

  // Helper to find current filter value for a property
  const getFilter = useCallback(
    (property: string) => filters.find((f) => f.property === property),
    [filters]
  );

  // Update a single property's filter in the array
  const setFilter = useCallback(
    (property: string, operator: string, value: unknown) => {
      // Remove empty filters
      const isEmpty =
        value === "" ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === "object" && value !== null && !Array.isArray(value) &&
          Object.values(value as Record<string, string>).every((v) => !v));

      if (isEmpty) {
        onFiltersChange(filters.filter((f) => f.property !== property));
        return;
      }

      const existing = filters.findIndex((f) => f.property === property);
      if (existing >= 0) {
        const next = [...filters];
        next[existing] = { property, operator, value };
        onFiltersChange(next);
      } else {
        onFiltersChange([...filters, { property, operator, value }]);
      }
    },
    [filters, onFiltersChange]
  );

  if (filterableProps.length === 0) return null;

  const hasActiveFilters = filters.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Filters</span>

      {filterableProps.map(([key, def]) => {
        const control = controlTypeFor(def)!;

        if (control === "multi-select") {
          const current = getFilter(key);
          const selected = Array.isArray(current?.value) ? (current!.value as string[]) : [];
          return (
            <MultiSelectFilter
              key={key}
              property={key}
              options={def.options ?? []}
              selected={selected}
              onChange={(values) => setFilter(key, "in", values)}
            />
          );
        }

        if (control === "text") {
          const current = getFilter(key);
          const value = typeof current?.value === "string" ? current!.value : "";
          return (
            <TextFilter
              key={key}
              property={key}
              value={value}
              onChange={(v) => setFilter(key, "contains", v)}
            />
          );
        }

        if (control === "date-range") {
          const current = getFilter(key);
          const range = (current?.value as { from?: string; to?: string }) ?? {};
          return (
            <DateRangeFilter
              key={key}
              property={key}
              from={range.from ?? ""}
              to={range.to ?? ""}
              onChange={(from, to) => setFilter(key, "between", { from, to })}
            />
          );
        }

        return null;
      })}

      {hasActiveFilters && (
        <button
          onClick={() => onFiltersChange([])}
          className="text-[10px] text-slate-500 hover:text-white transition-colors ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
