"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { Panel, EmptyState } from "@/src/components/layout/Panel";
import { StatCard } from "@/src/components/layout/StatCard";
import { ROLE_LABELS, ROLES, type AppRole } from "@/src/lib/roles";

type Overview = {
  pendingApprovals: number;
  activeEmployees: number;
  exitsInProgress: number;
  payrollRunsThisMonth: number;
  missingOnboardingDocs: number;
  supervisorHeadcount?: number;
  supervisorExpiringDocs30d?: number;
  supervisorSubmissionSubmitted?: number;
  supervisorSubmissionPending?: number;
  supervisorSubmissionOverdue?: number;
};

type Employee = {
  id: string;
  fullName: string;
  employeeId: string;
  status: string;
  siteAssignment?: { site?: { id?: string } | null } | null;
};
type Approval = { id: string; status: string; employee?: { fullName?: string } };
type Timesheet = { id: string; status: string; employee?: { fullName?: string }; overtimeHrs?: number };
type ExitRecord = { id: string; exitStatus: string; employee?: { fullName?: string } };
type PayrollRun = { id: string; month: string; status: string; totalEmployees: number };
type ActivityRow = { id: string; type: string; subject: string; status: string; cta: string; href: string };
type QuickAction = { href: string; title: string; desc: string };
type SupervisorSite = { id: string; name: string; location: string };

function statusClass(status: string) {
  if (status.includes("APPROVED") || status.includes("ACTIVE") || status.includes("SENT")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status.includes("REJECTED") || status.includes("FAILED")) {
    return "bg-rose-100 text-rose-700";
  }
  if (status.includes("PENDING") || status.includes("DRAFT") || status.includes("VALIDATED")) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export function RoleDashboard({ role }: { role: AppRole }) {
  const [overview, setOverview] = useState<Overview>({
    pendingApprovals: 0,
    activeEmployees: 0,
    exitsInProgress: 0,
    payrollRunsThisMonth: 0,
    missingOnboardingDocs: 0,
    supervisorHeadcount: 0,
    supervisorExpiringDocs30d: 0,
    supervisorSubmissionSubmitted: 0,
    supervisorSubmissionPending: 0,
    supervisorSubmissionOverdue: 0,
  });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [exits, setExits] = useState<ExitRecord[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [supervisorSites, setSupervisorSites] = useState<SupervisorSite[]>([]);

  useEffect(() => {
    fetch("/api/dashboard/overview")
      .then((r) => r.json())
      .then((payload) => {
        if (!payload || typeof payload !== "object") return;
        setOverview({
          pendingApprovals: Number(payload.pendingApprovals ?? 0),
          activeEmployees: Number(payload.activeEmployees ?? 0),
          exitsInProgress: Number(payload.exitsInProgress ?? 0),
          payrollRunsThisMonth: Number(payload.payrollRunsThisMonth ?? 0),
          missingOnboardingDocs: Number(payload.missingOnboardingDocs ?? 0),
          supervisorHeadcount: Number(payload.supervisorHeadcount ?? 0),
          supervisorExpiringDocs30d: Number(payload.supervisorExpiringDocs30d ?? 0),
          supervisorSubmissionSubmitted: Number(payload.supervisorSubmissionSubmitted ?? 0),
          supervisorSubmissionPending: Number(payload.supervisorSubmissionPending ?? 0),
          supervisorSubmissionOverdue: Number(payload.supervisorSubmissionOverdue ?? 0),
        });
      })
      .catch(() => {});

    fetch("/api/employees")
      .then((r) => r.json())
      .then((payload) => setEmployees(Array.isArray(payload) ? payload : []))
      .catch(() => {});

    if (role === ROLES.SITE_SUPERVISOR) {
      fetch("/api/sites")
        .then((r) => r.json())
        .then((payload) => setSupervisorSites(Array.isArray(payload) ? payload : []))
        .catch(() => {});
    }

    if (role === ROLES.OPS_DIRECTOR || role === ROLES.OWNER || role === ROLES.HR_ADMIN) {
      fetch("/api/approvals")
        .then((r) => r.json())
        .then((payload) => setApprovals(Array.isArray(payload) ? payload : []))
        .catch(() => {});
    }
    if (role === ROLES.OPS_DIRECTOR || role === ROLES.OWNER || role === ROLES.SITE_SUPERVISOR) {
      fetch("/api/timesheets")
        .then((r) => r.json())
        .then((payload) => setTimesheets(Array.isArray(payload) ? payload : []))
        .catch(() => {});
    }
    if (role === ROLES.HR_ADMIN || role === ROLES.OWNER) {
      fetch("/api/exit")
        .then((r) => r.json())
        .then((payload) => setExits(Array.isArray(payload) ? payload : []))
        .catch(() => {});
    }
    if (role === ROLES.HR_ADMIN || role === ROLES.OPS_DIRECTOR || role === ROLES.OWNER) {
      fetch("/api/payroll")
        .then((r) => r.json())
        .then((payload) => setRuns(Array.isArray(payload) ? payload : []))
        .catch(() => {});
    }
  }, [role]);

  const roleTitle = `${ROLE_LABELS[role]} Dashboard`;

  const kpis = useMemo(() => {
    if (role === ROLES.SITE_SUPERVISOR) {
      return [
        {
          label: "Site employees",
          value: overview.supervisorHeadcount ?? 0,
          hint: "Active employees at your sites",
          actionLabel: "View roster",
          tone: "success" as const,
        },
        {
          label: "Docs expiring in 30d",
          value: overview.supervisorExpiringDocs30d ?? 0,
          hint: "Read-only compliance alert",
          actionLabel: "Open compliance",
          tone: "warning" as const,
        },
        {
          label: "Submitted periods",
          value: overview.supervisorSubmissionSubmitted ?? 0,
          hint: "Current month submissions",
          actionLabel: "Open timesheets",
          tone: "default" as const,
        },
        {
          label: "Pending/overdue periods",
          value: (overview.supervisorSubmissionPending ?? 0) + (overview.supervisorSubmissionOverdue ?? 0),
          hint: "Requires submission action",
          actionLabel: "Submit now",
          tone: "warning" as const,
        },
      ];
    }
    const canAct = role !== ROLES.OWNER;
    return [
      {
        label: "Pending approvals",
        value: approvals.filter((a) => a.status === "PENDING").length,
        hint: "Items waiting for decision",
        actionLabel: canAct ? "Open approvals" : undefined,
        tone: "warning" as const,
      },
      {
        label: "Active employees",
        value: overview.activeEmployees,
        hint: "Current active workforce",
        actionLabel: canAct ? "View employees" : undefined,
        tone: "success" as const,
      },
      {
        label: "Payroll runs",
        value: overview.payrollRunsThisMonth,
        hint: "Monthly payroll pipeline",
        actionLabel: role === ROLES.HR_ADMIN || role === ROLES.OPS_DIRECTOR ? "Open payroll" : undefined,
        tone: "default" as const,
      },
      {
        label: "Offboarding in progress",
        value: overview.exitsInProgress,
        hint: "Offboarding queue",
        actionLabel: role === ROLES.HR_ADMIN ? "Review offboarding" : undefined,
        tone: "default" as const,
      },
    ];
  }, [approvals, overview, role]);

  const activityRows = useMemo<ActivityRow[]>(() => {
    if (role === ROLES.HR_ADMIN) {
      return [
        ...employees.slice(0, 4).map((employee) => ({
          id: employee.id,
          type: "Employee",
          subject: `${employee.fullName} (${employee.employeeId})`,
          status: employee.status,
          cta: "Review",
          href: `/employees/${employee.id}`,
        })),
        ...exits.slice(0, 3).map((exitRecord) => ({
          id: exitRecord.id,
          type: "Offboarding",
          subject: exitRecord.employee?.fullName ?? "Employee",
          status: exitRecord.exitStatus,
          cta: "Process",
          href: "/exit",
        })),
      ].slice(0, 7);
    }
    if (role === ROLES.OPS_DIRECTOR) {
      return [
        ...approvals.slice(0, 4).map((approval) => ({
          id: approval.id,
          type: "Approval",
          subject: approval.employee?.fullName ?? "Employee",
          status: approval.status,
          cta: "Decide",
          href: "/approvals",
        })),
        ...timesheets.slice(0, 3).map((timesheet) => ({
          id: timesheet.id,
          type: "Timesheet",
          subject: timesheet.employee?.fullName ?? "Employee",
          status: timesheet.status,
          cta: "Review",
          href: "/timesheets",
        })),
      ].slice(0, 7);
    }
    if (role === ROLES.SITE_SUPERVISOR) {
      return timesheets.slice(0, 7).map((timesheet) => ({
        id: timesheet.id,
        type: "Timesheet",
        subject: timesheet.employee?.fullName ?? "Employee",
        status: timesheet.status,
        cta: "Update",
        href: "/timesheets",
      }));
    }
    return [
      ...approvals.slice(0, 3).map((approval) => ({
        id: approval.id,
        type: "Approval",
        subject: approval.employee?.fullName ?? "Employee",
        status: approval.status,
        cta: "View",
        href: "/approvals",
      })),
      ...runs.slice(0, 3).map((run) => ({
        id: run.id,
        type: "Payroll",
        subject: run.month,
        status: run.status,
        cta: "View",
        href: `/payroll/${run.id}`,
      })),
    ];
  }, [approvals, employees, exits, role, runs, timesheets]);

  const quickActions = useMemo<QuickAction[]>(() => {
    if (role === ROLES.OWNER) {
      return [
        {
          href: "/compensation",
          title: "Pay accrual",
          desc: "View cumulative gross and net from locked timesheets through a chosen month.",
        },
      ];
    }
    if (role === ROLES.HR_ADMIN) {
      return [
        { href: "/employees", title: "Employees & onboarding", desc: "Browse the roster, start onboarding, or resume drafts." },
        { href: "/compliance", title: "Compliance", desc: "Review expiring records and document gaps." },
        { href: "/payroll", title: "Prepare payroll", desc: "Build and validate monthly payroll data." },
        {
          href: "/compensation",
          title: "Compensation accrual",
          desc: "Locked-timesheet gross and net totals by employee and month.",
        },
      ];
    }
    if (role === ROLES.OPS_DIRECTOR) {
      return [
        { href: "/approvals", title: "Approve onboarding", desc: "Final decision on pending onboarding records." },
        { href: "/timesheets", title: "Review timesheets", desc: "Check overtime and site productivity." },
        { href: "/sites?action=add", title: "Add site", desc: "Create a new site and then assign supervisors and ownership." },
        {
          href: "/compensation",
          title: "Compensation accrual",
          desc: "Locked-timesheet gross and net totals by employee and month.",
        },
      ];
    }
    return [
      { href: "/timesheets", title: "Submit timesheets", desc: "Submit site team weekly attendance." },
      { href: "/sites", title: "Track roster", desc: "Monitor assigned site headcount and coverage." },
    ];
  }, [role]);

  const alerts = useMemo(() => {
    const docGap =
      role === ROLES.HR_ADMIN && overview.missingOnboardingDocs > 0
        ? [
            {
              id: "onboarding-docs",
              title: "Onboarding document gaps",
              detail: `${overview.missingOnboardingDocs} employee record(s) need passport or Emirates ID file upload`,
              tone: "amber" as const,
              href: "/employees",
            },
          ]
        : [];

    if (role === ROLES.SITE_SUPERVISOR) {
      return [
        {
          id: "supervisor-compliance",
          title: "Expiring documents",
          detail: `${overview.supervisorExpiringDocs30d ?? 0} employee document(s) expiring in 30 days`,
          tone: "amber" as const,
          href: "/compliance",
        },
        {
          id: "supervisor-submission",
          title: "Submission status",
          detail: `${overview.supervisorSubmissionPending ?? 0} pending, ${overview.supervisorSubmissionOverdue ?? 0} overdue`,
          tone: "rose" as const,
          href: "/timesheets",
        },
      ];
    }

    return [
      ...docGap,
      {
        id: "approvals",
        title: "Approvals waiting",
        detail: `${approvals.filter((a) => a.status === "PENDING").length} pending decisions`,
        tone: "rose" as const,
        href: "/approvals",
      },
      {
        id: "timesheets",
        title: "Timesheet backlog",
        detail: `${timesheets.filter((t) => t.status === "PENDING").length} pending submissions`,
        tone: "amber" as const,
        href: "/timesheets",
      },
      {
        id: "exits",
        title: "Offboarding",
        detail: `${overview.exitsInProgress} offboarding case(s) in progress`,
        tone: "slate" as const,
        href: "/exit",
      },
    ];
  }, [
    approvals,
    overview.exitsInProgress,
    overview.missingOnboardingDocs,
    overview.supervisorExpiringDocs30d,
    overview.supervisorSubmissionOverdue,
    overview.supervisorSubmissionPending,
    role,
    timesheets,
  ]);

  const supervisorSiteRows = useMemo(() => {
    if (role !== ROLES.SITE_SUPERVISOR) return [];
    return supervisorSites.map((site) => ({
      site,
      employees: employees.filter((employee) => employee.siteAssignment?.site?.id === site.id),
    }));
  }, [employees, role, supervisorSites]);

  return (
    <div className="space-y-4">
      <PageHeader title={roleTitle} subtitle="Track operations, act on queue items, and monitor role-specific alerts." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            actionLabel={kpi.actionLabel}
            tone={kpi.tone}
          />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.6fr_0.9fr]">
        <Panel
          title="Activity"
          action={
            <button type="button" className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">
              Filters
            </button>
          }
        >
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <input
              aria-label="Search activity"
              placeholder="Search activity"
              className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
          {activityRows.length === 0 ? (
            <EmptyState message="No activity available right now." />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-600">{row.type}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.subject}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={row.href} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                          {row.cta}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="space-y-3">
          <Panel title="Quick actions">
            {quickActions.length === 0 ? (
              <p className="text-xs text-slate-500">Read-only role. No write actions available.</p>
            ) : (
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <Link key={action.href} href={action.href} className="block rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-white hover:bg-slate-800">
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-[11px] text-slate-200">{action.desc}</p>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Alerts">
            <div className="space-y-2">
              {alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  className={`block rounded-lg border px-3 py-2 ${
                    alert.tone === "rose"
                      ? "border-rose-200 bg-rose-50"
                      : alert.tone === "amber"
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-800">{alert.title}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{alert.detail}</p>
                </Link>
              ))}
            </div>
          </Panel>
          {role === ROLES.SITE_SUPERVISOR ? (
            <Panel title="My sites and employees">
              {supervisorSiteRows.length === 0 ? (
                <p className="text-xs text-slate-500">No sites are assigned to you yet.</p>
              ) : (
                <div className="space-y-2">
                  {supervisorSiteRows.map(({ site, employees: siteEmployees }) => (
                    <div key={site.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-900">{site.name}</p>
                      <p className="text-[11px] text-slate-500">{site.location}</p>
                      <p className="mt-1 text-xs font-medium text-slate-700">{siteEmployees.length} employee(s)</p>
                      {siteEmployees.length > 0 ? (
                        <div className="mt-1 text-[11px] text-slate-600">
                          {siteEmployees.map((employee) => employee.fullName).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
