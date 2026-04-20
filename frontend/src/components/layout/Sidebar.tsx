"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  ListChecks,
  Users,
} from "lucide-react";
import { PAGE_ACCESS, canAccessPage } from "@/src/lib/permissions";
import type { AppRole } from "@/src/lib/roles";

const links = [
  {
    section: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    section: "Employee Cycle",
    items: [
      { href: "/employees", label: "Employees", icon: Users },
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
      { href: "/timesheets", label: "Timesheets", icon: ListChecks },
      { href: "/payroll", label: "Payroll", icon: BriefcaseBusiness },
      {
        href: "/compensation",
        label: "Compensation",
        icon: CircleDollarSign,
      },
      { href: "/exit", label: "Offboarding", icon: FileClock },
    ],
  },
  {
    section: "Operations",
    items: [
      {
        href: "/compliance",
        label: "Compliance",
        icon: ClipboardCheck,
      },
      { href: "/sites", label: "Sites", icon: Building2 },
    ],
  },
];

export function Sidebar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const groups = links
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPage(item.href as keyof typeof PAGE_ACCESS, role)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-full rounded-3xl bg-[#0F172A] p-3 shadow-lg lg:sticky lg:top-4 lg:h-[calc(100vh-6.5rem)] lg:w-72 lg:overflow-y-auto">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">Workspace</p>
        <p className="mt-1 text-sm font-semibold text-slate-100">UAE HRMS</p>
      </div>
      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <section key={group.section} className="space-y-1.5 border-t border-white/10 pt-4 first:border-t-0 first:pt-0">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{group.section}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-2 rounded-full px-3 py-2 text-sm transition duration-200 ${
                    isActive
                      ? "bg-[#3B82F6] text-white shadow-sm"
                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 transition ${isActive ? "text-white" : "text-slate-300 group-hover:text-white"}`} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </aside>
  );
}
