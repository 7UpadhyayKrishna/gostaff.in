"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  id?: string;
  children: ReactNode;
};

export function CollapsibleSection({ title, subtitle, defaultOpen = true, badge, id, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const autoId = useId();
  const panelId = id ?? `collapsible-${autoId}`;
  const headerId = `${panelId}-header`;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <button
        id={headerId}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50/90 md:px-5"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900 md:text-lg">{title}</h2>
            {badge ? <span className="shrink-0">{badge}</span> : null}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={headerId} className="border-t border-slate-100">
          <div className="px-4 py-4 md:px-5 md:py-5">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
