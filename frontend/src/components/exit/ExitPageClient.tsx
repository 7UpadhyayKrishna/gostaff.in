"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { cn } from "@/src/lib/utils";

type ExitRow = {
  id: string;
  employeeId: string;
  exitStatus: string;
  employee?: { id?: string; fullName?: string; employeeId?: string };
};

type EmployeeRow = {
  id: string;
  employeeId: string;
  fullName: string;
  status: string;
  department: string;
  jobTitle: string;
};

function formatEnum(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s.includes("COMPLETE") || s.includes("CLOSED") || s.includes("SETTLED")) return "bg-emerald-100 text-emerald-900";
  if (s.includes("PENDING") || s.includes("DRAFT") || s.includes("IN_PROGRESS")) return "bg-amber-100 text-amber-950";
  if (s.includes("REJECT") || s.includes("CANCEL")) return "bg-rose-100 text-rose-900";
  return "bg-slate-100 text-slate-800";
}

function employeeStatusBadgeClass(status: string) {
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "CONDITIONALLY_APPROVED") return "bg-emerald-100 text-emerald-900";
  return "bg-slate-100 text-slate-800";
}

function canStartOffboardingStatus(status: string) {
  const s = status.toUpperCase();
  return s === "ACTIVE" || s === "CONDITIONALLY_APPROVED";
}

export function ExitPageClient() {
  const [rows, setRows] = useState<ExitRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [exitError, setExitError] = useState("");
  const [employeesError, setEmployeesError] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeListOpen, setEmployeeListOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/exit"), fetch("/api/employees")])
      .then(async ([exitRes, empRes]) => {
        const exitPayload = await exitRes.json();
        const empPayload = await empRes.json();
        if (cancelled) return;
        if (Array.isArray(exitPayload)) {
          setRows(exitPayload);
          setExitError("");
        } else {
          setExitError(exitPayload?.error ?? "Unable to load offboarding cases");
        }
        if (Array.isArray(empPayload)) {
          setEmployees(empPayload);
          setEmployeesError("");
        } else {
          setEmployeesError(empPayload?.error ?? "Unable to load employees");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExitError("Unable to load offboarding cases");
          setEmployeesError("Unable to load employees");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openExitEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of rows) {
      if (r.exitStatus !== "COMPLETED" && r.employeeId) ids.add(r.employeeId);
    }
    return ids;
  }, [rows]);

  const startCandidates = useMemo(() => {
    return employees.filter(
      (e) => canStartOffboardingStatus(e.status) && !openExitEmployeeIds.has(e.id),
    );
  }, [employees, openExitEmployeeIds]);

  const filteredCases = useMemo(() => {
    const q = caseQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = `${row.employee?.fullName ?? ""} ${row.employee?.employeeId ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, caseQuery]);

  const filteredStartList = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (!q) return startCandidates;
    return startCandidates.filter((e) => {
      const hay = `${e.fullName} ${e.employeeId} ${e.department} ${e.jobTitle}`.toLowerCase();
      return hay.includes(q);
    });
  }, [startCandidates, employeeQuery]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Offboarding</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Use <strong className="font-semibold text-slate-800">Choose an employee</strong> below to open the list, pick someone, then complete their offboarding form. Open cases appear under Cases.
          </p>
          <p className="mt-2 text-sm">
            <Link href="/employees" className="font-semibold text-blue-700 underline-offset-2 hover:underline">
              Browse full directory
            </Link>
          </p>
        </div>
      </div>

      <div id="start-offboarding" className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Start offboarding</h2>
          <p className="text-xs text-slate-600">
            Click the button to show active employees. Choosing one opens the offboarding form.
          </p>
        </div>
        <div className="px-4 py-4 md:px-5 md:py-5">
          {!employeeListOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 sm:w-auto"
                aria-expanded={employeeListOpen}
                onClick={() => setEmployeeListOpen(true)}
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Choose an employee
              </button>
              {!employeesError ? (
                <p className="text-center text-xs text-slate-500 sm:text-left">
                  {startCandidates.length} eligible right now
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-sm font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                  aria-expanded
                  onClick={() => setEmployeeListOpen(false)}
                >
                  Hide list
                </button>
              </div>
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                  placeholder="Search name, employee ID, role, or department"
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  aria-label="Filter employees to start offboarding"
                />
              </div>
            </div>
          )}
        </div>
        {employeesError ? (
          <div className="border-t border-slate-100 px-4 py-3 text-sm text-amber-950 md:px-5">{employeesError}</div>
        ) : null}
        {employeeListOpen ? (
          <div id="offboarding-employee-list" className="border-t border-slate-100 px-2 py-2 md:px-3 md:py-3">
            {filteredStartList.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500 md:px-3">
                {startCandidates.length === 0
                  ? "No eligible employees right now. Employees already on exit appear under Cases, and the directory lists everyone else."
                  : "No employees match your search."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredStartList.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/employees/${e.id}/exit`}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50 md:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900">{e.fullName}</p>
                        <p className="truncate text-sm text-slate-500">
                          {e.employeeId}
                          <span className="text-slate-300"> · </span>
                          {e.jobTitle}
                          <span className="text-slate-300"> · </span>
                          {e.department}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize sm:inline-flex",
                          employeeStatusBadgeClass(e.status),
                        )}
                      >
                        {formatEnum(e.status)}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-700">
                        Start
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold text-slate-900">Cases</h2>
          <p className="text-xs text-slate-600">Search by employee name or ID.</p>
        </div>
        <div className="px-4 py-3 md:px-5">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              placeholder="Search name or employee ID"
              value={caseQuery}
              onChange={(e) => setCaseQuery(e.target.value)}
              aria-label="Filter offboarding cases"
            />
          </div>
        </div>
      </div>

      {exitError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{exitError}</div> : null}

      <div className="space-y-2">
        {filteredCases.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{row.employee?.fullName ?? "Employee"}</p>
              <p className="text-sm text-slate-500">{row.employee?.employeeId}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", statusTone(row.exitStatus))}>{row.exitStatus}</span>
              <Link
                href={`/exit/${row.id}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-slate-100"
              >
                Open case
              </Link>
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No offboarding cases yet.</p>
            <p className="mt-1 text-sm text-slate-500">When you start offboarding for someone above, their case will show up here.</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">No cases match your search.</p>
        ) : null}
      </div>
    </div>
  );
}
