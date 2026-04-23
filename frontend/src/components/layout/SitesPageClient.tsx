"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { StatCard } from "@/src/components/layout/StatCard";
import { ROLES, type AppRole } from "@/src/lib/roles";
import { cn } from "@/src/lib/utils";

type ShiftPattern = "MORNING" | "EVENING" | "NIGHT" | "ROTATING";

type EmployeeRow = {
  id: string;
  employeeId: string;
  fullName: string;
  status: string;
  contractStart?: string | Date | null;
  department?: string | null;
  jobTitle?: string | null;
  payrollConfig?: { basicSalary?: number | null } | null;
  siteAssignment?: {
    shiftPattern?: ShiftPattern | null;
    shiftStart?: string | Date | null;
    site?: { id?: string; name?: string; location?: string } | null;
  } | null;
};

type SiteRow = {
  id: string;
  name: string;
  location: string;
  supervisorUserId?: string | null;
  supervisor?: { id: string; name: string; email: string } | null;
  _count?: { assignments?: number };
};

type Supervisor = {
  id: string;
  name: string;
  email: string;
};

function formatEnumLabel(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SitesPageClient({ role }: { role: AppRole }) {
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteLocation, setNewSiteLocation] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [employeeAssignments, setEmployeeAssignments] = useState<
    Record<string, { siteId: string; shiftPattern: ShiftPattern }>
  >({});
  const [siteFilter, setSiteFilter] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [showAddSite, setShowAddSite] = useState(false);

  const canCreate = role === ROLES.OPS_DIRECTOR;
  const canAssign = role === ROLES.OPS_DIRECTOR;
  const loadSupervisorsList = role === ROLES.OPS_DIRECTOR || role === ROLES.OWNER;

  const loadAll = useCallback(async () => {
    setError("");
    const requests = [fetch("/api/employees"), fetch("/api/sites")] as const;
    const [employeesRes, sitesRes] = await Promise.all(requests);
    const [employeesPayload, sitesPayload] = await Promise.all([employeesRes.json(), sitesRes.json()]);

    let supervisorsPayload: Supervisor[] = [];
    if (loadSupervisorsList) {
      const supervisorsRes = await fetch("/api/users/supervisors");
      const supervisorsData = await supervisorsRes.json();
      if (!supervisorsRes.ok) throw new Error(supervisorsData?.error ?? "Unable to load supervisors");
      supervisorsPayload = Array.isArray(supervisorsData) ? supervisorsData : [];
    }

    if (!employeesRes.ok) throw new Error(employeesPayload?.error ?? "Unable to load employees");
    if (!sitesRes.ok) throw new Error(sitesPayload?.error ?? "Unable to load sites");

    const employeeList = Array.isArray(employeesPayload) ? employeesPayload : [];
    setRows(employeeList);
    const nextSites = Array.isArray(sitesPayload) ? sitesPayload : [];
    setSites(nextSites);
    setSupervisors(Array.isArray(supervisorsPayload) ? supervisorsPayload : []);
    setAssignments(
      Object.fromEntries(
        nextSites.map((site: SiteRow) => [
          site.id,
          typeof site.supervisorUserId === "string" && site.supervisorUserId.length > 0 ? site.supervisorUserId : "",
        ]),
      ),
    );
    setEmployeeAssignments(
      Object.fromEntries(
        employeeList.map((row: EmployeeRow) => {
          const sp = row.siteAssignment?.shiftPattern;
          const shiftPattern: ShiftPattern =
            sp === "EVENING" || sp === "NIGHT" || sp === "ROTATING" ? sp : "MORNING";
          return [
            row.id,
            {
              siteId: row.siteAssignment?.site?.id ?? "",
              shiftPattern,
            },
          ];
        }),
      ),
    );
  }, [loadSupervisorsList]);

  useEffect(() => {
    loadAll().catch((e) => setError(e instanceof Error ? e.message : "Unable to load site assignments"));
  }, [loadAll]);

  useEffect(() => {
    if (!canCreate) return;
    if (searchParams.get("action") === "add") {
      setShowAddSite(true);
    }
  }, [canCreate, searchParams]);

  const filteredSites = useMemo(() => {
    const q = siteFilter.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) => s.name.toLowerCase().includes(q) || s.location.toLowerCase().includes(q),
    );
  }, [sites, siteFilter]);

  const selectedSite = useMemo(
    () => (selectedSiteId ? sites.find((s) => s.id === selectedSiteId) ?? null : null),
    [sites, selectedSiteId],
  );

  const employeesAtSelectedSite = useMemo(() => {
    if (!selectedSiteId) return [];
    return rows.filter((r) => r.siteAssignment?.site?.id === selectedSiteId);
  }, [rows, selectedSiteId]);

  const assigned = rows.filter((r) => r.siteAssignment?.site?.name).length;
  const unassigned = rows.length - assigned;

  async function createSite() {
    setStatus("");
    setError("");
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSiteName, location: newSiteLocation }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to create site");
      return;
    }
    setNewSiteName("");
    setNewSiteLocation("");
    setStatus("Site created.");
    setShowAddSite(false);
    if (payload?.id) setSelectedSiteId(payload.id as string);
    await loadAll();
  }

  async function assignSupervisor(siteId: string) {
    setStatus("");
    setError("");
    const selectedSupervisorId = assignments[siteId] || "";
    if (selectedSupervisorId) {
      const existingSites = sites.filter(
        (site) => site.id !== siteId && site.supervisorUserId === selectedSupervisorId,
      );
      if (existingSites.length > 0) {
        const supervisorName =
          supervisors.find((sup) => sup.id === selectedSupervisorId)?.name ??
          existingSites[0]?.supervisor?.name ??
          "This supervisor";
        const assignedSiteNames = existingSites.map((site) => site.name).join(", ");
        const shouldProceed = window.confirm(
          `${supervisorName} is already assigned to: ${assignedSiteNames}. Do you still want to assign this supervisor to another site?`,
        );
        if (!shouldProceed) return;
      }
    }
    const response = await fetch(`/api/sites/${siteId}/supervisor`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supervisorUserId: selectedSupervisorId || null }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to assign supervisor");
      return;
    }
    setStatus("Supervisor assignment updated.");
    await loadAll();
  }

  async function assignEmployee(employeeId: string) {
    setStatus("");
    setError("");
    const payload = employeeAssignments[employeeId];
    if (!payload?.siteId) {
      setError("Please choose a site before saving assignment.");
      return;
    }
    const response = await fetch(`/api/employees/${employeeId}/site-assignment`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: payload.siteId,
        shiftPattern: payload.shiftPattern,
        shiftStart: new Date().toISOString(),
      }),
    });
    const responsePayload = await response.json();
    if (!response.ok) {
      setError(responsePayload?.error ?? "Unable to assign employee to site");
      return;
    }
    setStatus("Employee assignment updated.");
    await loadAll();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sites"
        subtitle={
          canCreate
            ? "Browse sites, review supervisors and rosters, and add new locations."
            : "Site coverage, supervisors, and assignment controls."
        }
      />
      {error ? <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{error}</div> : null}
      {status ? <div className="rounded border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-900">{status}</div> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Total Employees" value={rows.length} />
        <StatCard label="Assigned" value={assigned} tone="success" />
        <StatCard label="Unassigned" value={unassigned} tone={unassigned > 0 ? "warning" : "default"} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-md">
          <label htmlFor="site-filter" className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Filter sites
          </label>
          <input
            id="site-filter"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
            placeholder="Search by site name or location"
            value={siteFilter}
            onChange={(e) => setSiteFilter(e.target.value)}
          />
        </div>
        {canCreate ? (
          <div className="flex shrink-0 items-end gap-2 sm:items-center">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => setShowAddSite((v) => !v)}
            >
              {showAddSite ? "Close" : "Add site"}
            </button>
          </div>
        ) : null}
      </div>

      {canCreate && showAddSite ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">New site</h3>
          <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Site name</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="e.g. Warehouse North"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Location</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="City or area"
                value={newSiteLocation}
                onChange={(e) => setNewSiteLocation(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={createSite}
              >
                Create site
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sites</h3>
          <ul className="max-h-[min(70vh,520px)] space-y-1 overflow-y-auto pr-1">
            {filteredSites.length === 0 ? (
              <li className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                No sites match this filter.
              </li>
            ) : (
              filteredSites.map((site) => {
                const headcount = rows.filter((r) => r.siteAssignment?.site?.id === site.id).length;
                const isActive = selectedSiteId === site.id;
                return (
                  <li key={site.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSiteId(site.id)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition hover:border-slate-300 hover:bg-slate-50",
                        isActive ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/30" : "border-slate-200 bg-white",
                      )}
                    >
                      <p className="text-sm font-semibold text-slate-900">{site.name}</p>
                      <p className="text-xs text-slate-500">{site.location}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                        <span>{headcount} employee{headcount === 1 ? "" : "s"}</span>
                        <span className="text-slate-300">·</span>
                        <span className="truncate">
                          {site.supervisor?.name ? `Supervisor: ${site.supervisor.name}` : "No supervisor"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selectedSite ? (
            <p className="text-sm text-slate-500">Select a site to view the supervisor and employee roster.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedSite.name}</h3>
                <p className="text-sm text-slate-500">{selectedSite.location}</p>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Site supervisor</p>
                {selectedSite.supervisor ? (
                  <div className="mt-1 text-sm text-slate-800">
                    <p className="font-medium">{selectedSite.supervisor.name}</p>
                    <p className="text-slate-600">{selectedSite.supervisor.email}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-600">No supervisor assigned yet.</p>
                )}
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">
                  Employees at this site ({employeesAtSelectedSite.length})
                </h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Employee ID</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Job title</th>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Shift</th>
                        <th className="px-3 py-2">Contract start</th>
                        {role !== ROLES.SITE_SUPERVISOR ? (
                          <th className="px-3 py-2 text-right">Basic (AED)</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {employeesAtSelectedSite.length === 0 ? (
                        <tr>
                          <td
                            colSpan={role === ROLES.SITE_SUPERVISOR ? 7 : 8}
                            className="px-3 py-6 text-center text-sm text-slate-500"
                          >
                            No employees are assigned to this site yet.
                          </td>
                        </tr>
                      ) : (
                        employeesAtSelectedSite.map((emp) => (
                          <tr key={emp.id} className="border-b border-slate-100 last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">{emp.employeeId}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{emp.fullName}</td>
                            <td className="px-3 py-2 text-slate-700">{formatEnumLabel(emp.jobTitle ?? undefined)}</td>
                            <td className="px-3 py-2 text-slate-700">{formatEnumLabel(emp.department ?? undefined)}</td>
                            <td className="px-3 py-2 text-slate-700">{formatEnumLabel(emp.status)}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {formatEnumLabel(emp.siteAssignment?.shiftPattern ?? undefined)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(emp.contractStart)}</td>
                            {role !== ROLES.SITE_SUPERVISOR ? (
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                                {emp.payrollConfig?.basicSalary != null
                                  ? Number(emp.payrollConfig.basicSalary).toLocaleString()
                                  : "—"}
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {(canAssign || role === ROLES.OWNER) && (
        <div className="rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Supervisor assignment by site</h3>
          <div className="space-y-2">
            {sites.map((site) => (
              <div key={site.id} className="grid gap-2 rounded border p-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  <p className="text-xs text-slate-500">{site.location}</p>
                </div>
                <select
                  className="rounded border p-2 text-sm"
                  disabled={!canAssign}
                  value={assignments[site.id] ?? ""}
                  onChange={(e) => setAssignments((prev) => ({ ...prev, [site.id]: e.target.value }))}
                >
                  <option value="">Unassigned</option>
                  {supervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.email})
                    </option>
                  ))}
                </select>
                {canAssign ? (
                  <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => assignSupervisor(site.id)}>
                    Save
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {(canAssign || role === ROLES.OWNER) && (
        <div className="rounded border p-3">
          <h3 className="mb-2 text-sm font-semibold">Employee assignment to site</h3>
          <div className="space-y-2">
            {rows.map((employee) => (
              <div key={employee.id} className="grid gap-2 rounded border p-2 md:grid-cols-[1fr_1fr_180px_auto] md:items-center">
                <div>
                  <p className="text-sm font-medium">{employee.fullName}</p>
                  <p className="text-xs text-slate-500">Current: {employee.siteAssignment?.site?.name ?? "Unassigned"}</p>
                </div>
                <select
                  className="rounded border p-2 text-sm"
                  disabled={!canAssign}
                  value={employeeAssignments[employee.id]?.siteId ?? ""}
                  onChange={(e) =>
                    setEmployeeAssignments((prev) => ({
                      ...prev,
                      [employee.id]: {
                        siteId: e.target.value,
                        shiftPattern: prev[employee.id]?.shiftPattern ?? "MORNING",
                      },
                    }))
                  }
                >
                  <option value="">Select site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} ({site.location})
                    </option>
                  ))}
                </select>
                <select
                  className="rounded border p-2 text-sm"
                  disabled={!canAssign}
                  value={employeeAssignments[employee.id]?.shiftPattern ?? "MORNING"}
                  onChange={(e) =>
                    setEmployeeAssignments((prev) => ({
                      ...prev,
                      [employee.id]: {
                        siteId: prev[employee.id]?.siteId ?? "",
                        shiftPattern: e.target.value as ShiftPattern,
                      },
                    }))
                  }
                >
                  <option value="MORNING">Morning</option>
                  <option value="EVENING">Evening</option>
                  <option value="NIGHT">Night</option>
                  <option value="ROTATING">Rotating</option>
                </select>
                {canAssign ? (
                  <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={() => assignEmployee(employee.id)}>
                    Save
                  </button>
                ) : null}
              </div>
            ))}
            {rows.length === 0 ? <p className="text-xs text-slate-500">No employees available to assign.</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
