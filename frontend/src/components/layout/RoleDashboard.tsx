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
  siteAssignment?: { site?: { id?: string; name?: string } | null } | null;
  _count?: { documents?: number };
};
type Approval = { id: string; status: string; employee?: { fullName?: string } };
type Timesheet = { id: string; status: string; employee?: { fullName?: string }; overtimeHrs?: number };
type ExitRecord = { id: string; exitStatus: string; employee?: { fullName?: string } };
type PayrollRun = { id: string; month: string; status: string; totalEmployees: number };
type ActivityRow = { id: string; type: string; subject: string; status: string; cta: string; href: string };
type QuickAction = { href: string; title: string; desc: string };
type SupervisorSite = { id: string; name: string; location: string };
type MetricPoint = { label: string; value: number };
type CompensationEmployeeRow = { id: string; totalNet?: number };
type DashboardAlert = {
  id: string;
  title: string;
  detail: string;
  tone: "rose" | "amber" | "slate";
  href: string;
  count?: number;
  cta?: string;
};

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

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized.includes("APPROVED") || normalized.includes("ACTIVE") || normalized.includes("SENT")) return "bg-emerald-500";
  if (normalized.includes("REJECTED") || normalized.includes("FAILED") || normalized.includes("OVERDUE")) return "bg-rose-500";
  if (normalized.includes("PENDING") || normalized.includes("DRAFT") || normalized.includes("VALIDATED")) return "bg-amber-500";
  return "bg-slate-500";
}

function metricMapToPoints(map: Map<string, number>, top = 6): MetricPoint[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([label, value]) => ({ label, value }));
}

function formatCompact(num: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(num);
}

function formatAed(amount: number) {
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(amount);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function parseMonthValue(month: string) {
  const direct = new Date(month);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  const normalized = new Date(`${month}-01`);
  if (!Number.isNaN(normalized.getTime())) return normalized.getTime();
  return 0;
}

function MiniTrendChart({ data }: { data: MetricPoint[] }) {
  const width = 520;
  const height = 160;
  if (data.length === 0) {
    return <p className="text-xs text-slate-500">No historical data available yet.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data
    .map((item, i) => {
      const x = i * stepX;
      const y = height - (item.value / max) * (height - 24) - 12;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full rounded-lg border border-slate-200 bg-slate-50 p-2">
        <polyline fill="none" stroke="#0f172a" strokeWidth="3" points={points} />
      </svg>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 md:grid-cols-6">
        {data.map((item) => (
          <div key={item.label} className="rounded-md bg-slate-100 px-2 py-1 text-center">
            <p className="truncate font-medium text-slate-700">{item.label}</p>
            <p>{formatCompact(item.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HorizontalMetricBars({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: MetricPoint[];
}) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <Panel title={title}>
      <p className="mb-3 text-[11px] text-slate-500">{subtitle}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">No records found.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="text-slate-500">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-800" style={{ width: `${Math.max((item.value / max) * 100, 6)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function RoleDashboard({ role }: { role: AppRole }) {
  const [ownerRangeMonths, setOwnerRangeMonths] = useState<3 | 6 | 12>(6);
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
  const [ownerCompRows, setOwnerCompRows] = useState<CompensationEmployeeRow[]>([]);

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

    if (role === ROLES.SITE_SUPERVISOR || role === ROLES.OWNER) {
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
    if (role === ROLES.OWNER) {
      fetch(`/api/dashboard/compensation-summary?asOfMonth=${encodeURIComponent(currentMonth())}`)
        .then((r) => r.json())
        .then((payload) => setOwnerCompRows(Array.isArray(payload?.employees) ? payload.employees : []))
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

  const alerts = useMemo<DashboardAlert[]>(() => {
    const docGap =
      role === ROLES.HR_ADMIN && overview.missingOnboardingDocs > 0
        ? [
            {
              id: "onboarding-docs",
              title: "Onboarding document gaps",
              detail: `${overview.missingOnboardingDocs} employee record(s) need passport or Emirates ID file upload`,
              tone: "amber" as const,
              href: "/employees",
              count: overview.missingOnboardingDocs,
              cta: "Fix documents",
            },
          ]
        : [];

    if (role === ROLES.SITE_SUPERVISOR) {
      const expiringDocs = overview.supervisorExpiringDocs30d ?? 0;
      const submissionGap = (overview.supervisorSubmissionPending ?? 0) + (overview.supervisorSubmissionOverdue ?? 0);
      return [
        {
          id: "supervisor-compliance",
          title: "Expiring documents",
          detail: `${expiringDocs} employee document(s) expiring in 30 days`,
          tone: "amber" as const,
          href: "/compliance",
          count: expiringDocs,
          cta: "Open compliance",
        },
        {
          id: "supervisor-submission",
          title: "Submission status",
          detail: `${overview.supervisorSubmissionPending ?? 0} pending, ${overview.supervisorSubmissionOverdue ?? 0} overdue`,
          tone: (overview.supervisorSubmissionOverdue ?? 0) > 0 ? ("rose" as const) : ("amber" as const),
          href: "/timesheets",
          count: submissionGap,
          cta: "Resolve timesheets",
        },
      ].filter((alert) => (alert.count ?? 0) > 0);
    }

    const pendingApprovals = approvals.filter((a) => a.status === "PENDING").length;
    const pendingTimesheets = timesheets.filter((t) => t.status === "PENDING").length;

    return [
      ...docGap,
      {
        id: "approvals",
        title: "Approvals waiting",
        detail: `${pendingApprovals} pending decisions`,
        tone: "rose" as const,
        href: "/approvals",
        count: pendingApprovals,
        cta: "Review approvals",
      },
      {
        id: "timesheets",
        title: "Timesheet backlog",
        detail: `${pendingTimesheets} pending submissions`,
        tone: "amber" as const,
        href: "/timesheets",
        count: pendingTimesheets,
        cta: "Review timesheets",
      },
      {
        id: "exits",
        title: "Offboarding",
        detail: `${overview.exitsInProgress} offboarding case(s) in progress`,
        tone: "slate" as const,
        href: "/exit",
        count: overview.exitsInProgress,
        cta: "Track exits",
      },
    ]
      .filter((alert) => (alert.count ?? 0) > 0)
      .sort((a, b) => {
        const priority = { rose: 3, amber: 2, slate: 1 } as const;
        if (priority[b.tone] !== priority[a.tone]) return priority[b.tone] - priority[a.tone];
        return (b.count ?? 0) - (a.count ?? 0);
      });
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

  const ownerAnalytics = useMemo(() => {
    if (role !== ROLES.OWNER) return null;

    const employeeStatusMap = new Map<string, number>();
    employees.forEach((employee) => {
      const status = employee.status || "UNKNOWN";
      employeeStatusMap.set(status, (employeeStatusMap.get(status) ?? 0) + 1);
    });

    const approvalStatusMap = new Map<string, number>();
    approvals.forEach((approval) => {
      const status = approval.status || "UNKNOWN";
      approvalStatusMap.set(status, (approvalStatusMap.get(status) ?? 0) + 1);
    });

    const timesheetStatusMap = new Map<string, number>();
    timesheets.forEach((timesheet) => {
      const status = timesheet.status || "UNKNOWN";
      timesheetStatusMap.set(status, (timesheetStatusMap.get(status) ?? 0) + 1);
    });

    const sortedRuns = [...runs].sort((a, b) => parseMonthValue(a.month) - parseMonthValue(b.month));
    const scopedRuns = sortedRuns.slice(-ownerRangeMonths);

    const payrollByMonthMap = new Map<string, number>();
    const payrollEmployeesByMonthMap = new Map<string, number>();
    scopedRuns.forEach((run) => {
      const month = run.month || "Unknown month";
      payrollByMonthMap.set(month, (payrollByMonthMap.get(month) ?? 0) + 1);
      payrollEmployeesByMonthMap.set(month, (payrollEmployeesByMonthMap.get(month) ?? 0) + Number(run.totalEmployees ?? 0));
    });

    const payrollMonths = [...payrollByMonthMap.keys()].slice(-ownerRangeMonths);
    const payrollRunsTrend = payrollMonths.map((month) => ({ label: month, value: payrollByMonthMap.get(month) ?? 0 }));
    const payrollCoverageTrend = payrollMonths.map((month) => ({
      label: month,
      value: payrollEmployeesByMonthMap.get(month) ?? 0,
    }));

    const totalPayrollEmployees = scopedRuns.reduce((sum, run) => sum + Number(run.totalEmployees ?? 0), 0);
    const averageEmployeesPerRun = scopedRuns.length === 0 ? 0 : Math.round(totalPayrollEmployees / scopedRuns.length);
    const pendingApprovals = approvals.filter((item) => item.status === "PENDING").length;
    const pendingTimesheets = timesheets.filter((item) => item.status === "PENDING").length;
    const estimatedPayoutDue = ownerCompRows.reduce((sum, row) => sum + Number(row.totalNet ?? 0), 0);
    const activeEmployeesMissingDocs = employees.filter((employee) => employee.status === "ACTIVE" && (employee._count?.documents ?? 0) === 0).length;
    const docsNotReceived = Math.max(activeEmployeesMissingDocs, Number(overview.missingOnboardingDocs ?? 0));
    const siteHeadcountMap = new Map<string, number>();
    employees.forEach((employee) => {
      const siteLabel = employee.siteAssignment?.site?.name?.trim() || "Unassigned";
      siteHeadcountMap.set(siteLabel, (siteHeadcountMap.get(siteLabel) ?? 0) + 1);
    });
    const siteWiseHeadcount = metricMapToPoints(siteHeadcountMap, 8);

    return {
      executiveStats: [
        { label: "Total employees tracked", value: employees.length, hint: "All employee records in the system", tone: "success" as const },
        { label: "Estimated payout due", value: formatAed(estimatedPayoutDue), hint: `Net payroll accrual through ${currentMonth()}`, tone: "default" as const },
        { label: "Documents not received", value: docsNotReceived, hint: "Missing passport/Emirates ID or no docs on active profile", tone: "warning" as const },
        { label: "Open approvals", value: pendingApprovals, hint: "Awaiting a decision from operations", tone: "warning" as const },
        { label: "Pending timesheets", value: pendingTimesheets, hint: "Submission queue across sites", tone: "warning" as const },
        { label: "Payroll employee lines", value: totalPayrollEmployees, hint: "Cumulative payroll coverage", tone: "default" as const },
      ],
      employeeStatus: metricMapToPoints(employeeStatusMap),
      approvalStatus: metricMapToPoints(approvalStatusMap),
      timesheetStatus: metricMapToPoints(timesheetStatusMap),
      payrollRunsTrend,
      payrollCoverageTrend,
      siteWiseHeadcount,
      highlights: [
        {
          label: "Approval completion",
          value:
            approvals.length === 0
              ? "N/A"
              : `${Math.round(((approvals.length - pendingApprovals) / approvals.length) * 100)}% complete`,
        },
        {
          label: "Timesheet completion",
          value:
            timesheets.length === 0
              ? "N/A"
              : `${Math.round(((timesheets.length - pendingTimesheets) / timesheets.length) * 100)}% submitted`,
        },
        {
          label: "Avg payroll coverage/run",
          value: `${formatCompact(averageEmployeesPerRun)} employees`,
        },
        {
          label: "Docs not received",
          value: `${docsNotReceived}`,
        },
      ],
      estimatedPayoutDue,
      docsNotReceived,
    };
  }, [approvals, employees, ownerCompRows, ownerRangeMonths, overview.missingOnboardingDocs, role, runs, timesheets]);

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
      {role === ROLES.OWNER && ownerAnalytics ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 text-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">Executive snapshot</p>
                <h2 className="mt-1 text-xl font-semibold">Owner command center</h2>
                <p className="mt-1 text-sm text-slate-300">A quick view of workforce health, approvals, submissions, and payroll coverage.</p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto lg:min-w-[480px]">
                {ownerAnalytics.highlights.map((item) => (
                  <div key={item.label} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                    <p className="text-[10px] uppercase tracking-wide text-slate-300">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <Panel
            title="Company pulse"
            action={
              <select
                value={ownerRangeMonths}
                onChange={(event) => setOwnerRangeMonths(Number(event.target.value) as 3 | 6 | 12)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm"
                aria-label="Select owner dashboard trend range"
              >
                <option value={3}>Last 3 months</option>
                <option value={6}>Last 6 months</option>
                <option value={12}>Last 12 months</option>
              </select>
            }
          >
            <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {ownerAnalytics.executiveStats.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                  <StatCard label={kpi.label} value={kpi.value} hint={kpi.hint} tone={kpi.tone} />
                </div>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-slate-900">Payroll runs trend</p>
                  <p className="text-[11px] text-slate-500">How many payroll runs are processed each month.</p>
                </div>
                <MiniTrendChart data={ownerAnalytics.payrollRunsTrend} />
              </div>
              <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3">
                <div className="mb-2">
                  <p className="text-sm font-semibold text-slate-900">Payroll coverage trend</p>
                  <p className="text-[11px] text-slate-500">Employee count included in payroll by month.</p>
                </div>
                <MiniTrendChart data={ownerAnalytics.payrollCoverageTrend} />
              </div>
            </div>
          </Panel>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Money to give</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">{formatAed(ownerAnalytics.estimatedPayoutDue)}</p>
              <p className="mt-1 text-xs text-emerald-800">Estimated total net salary payable from accrual data.</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Docs not received</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{ownerAnalytics.docsNotReceived}</p>
              <p className="mt-1 text-xs text-amber-800">Employees missing required docs or with no document uploaded.</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Site wise people</p>
              {ownerAnalytics.siteWiseHeadcount.length === 0 ? (
                <p className="mt-1 text-sm text-sky-900">No site allocations available.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {ownerAnalytics.siteWiseHeadcount.slice(0, 4).map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-md bg-white/80 px-2 py-1 text-xs">
                      <span className="truncate pr-2 font-medium text-sky-900">{item.label}</span>
                      <span className="font-semibold text-sky-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <HorizontalMetricBars title="Employee status mix" subtitle="Current workforce lifecycle distribution." items={ownerAnalytics.employeeStatus} />
            <HorizontalMetricBars title="Approval queue status" subtitle="How approvals are progressing company-wide." items={ownerAnalytics.approvalStatus} />
            <Panel title="Timesheet workflow">
              <p className="mb-3 text-[11px] text-slate-500">Submission stages across all current records.</p>
              {ownerAnalytics.timesheetStatus.length === 0 ? (
                <p className="text-xs text-slate-500">No records found.</p>
              ) : (
                <div className="space-y-2">
                  {ownerAnalytics.timesheetStatus.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${statusTone(item.label)}`} />
                        <span className="text-xs font-medium text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

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
            {alerts.length === 0 ? (
              <p className="text-xs text-slate-500">No active alerts right now.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    className={`block rounded-lg border px-3 py-2 transition hover:shadow-sm ${
                      alert.tone === "rose"
                        ? "border-rose-200 bg-rose-50"
                        : alert.tone === "amber"
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">{alert.title}</p>
                      {typeof alert.count === "number" ? (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {alert.count}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{alert.detail}</p>
                    {alert.cta ? <p className="mt-2 text-[11px] font-medium text-slate-700">{alert.cta} →</p> : null}
                  </Link>
                ))}
              </div>
            )}
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
