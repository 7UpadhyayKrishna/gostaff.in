"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Bell, CircleUserRound, Search, Settings2 } from "lucide-react";
import { DemoCountdown } from "@/src/components/layout/DemoCountdown";
import { ROLE_LABELS, ROLES, type AppRole } from "@/src/lib/roles";

export function Topbar({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const roleLabel = ROLE_LABELS[role];
  const showAddEmployeeInHeader = role === ROLES.HR_ADMIN && pathname !== "/employees";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-3 py-3 md:px-5 lg:px-6">
        <div className="flex min-w-[150px] items-center gap-3">
          <Image src="/gostaff-logo.png" alt="GoStaff logo" width={120} height={28} className="h-7 w-auto object-contain" priority />
        </div>
        <div className="hidden flex-1 justify-center md:flex">
          <div className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2 shadow-sm transition focus-within:ring-2 focus-within:ring-[#3B82F6]/20">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              aria-label="Search dashboard"
              placeholder="Search employees, drafts, or payroll"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Alerts"
          >
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Settings"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-[#F8FAFC] px-2 py-1.5 md:flex">
            <CircleUserRound className="h-4 w-4 text-[#0F172A]" />
            <span className="text-xs font-semibold text-slate-700">{roleLabel}</span>
          </div>
          {showAddEmployeeInHeader ? (
            <Link
              href="/employees/onboard"
              className="rounded-xl bg-[#3B82F6] px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-blue-500"
            >
              Add Employee
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
          >
            Logout
          </button>
          <div className="hidden md:block">
            <DemoCountdown />
          </div>
        </div>
      </div>
    </header>
  );
}
