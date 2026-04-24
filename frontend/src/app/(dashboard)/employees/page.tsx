"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { ROLES } from "@/src/lib/roles";
import { cn } from "@/src/lib/utils";

type EmployeeRow = {
  id: string;
  employeeId: string;
  fullName: string;
  status: string;
  onboardingStage?: number;
  department: string;
  jobTitle: string;
  payrollConfig?: { basicSalary?: number } | null;
  siteAssignment?: { site?: { name?: string } | null } | null;
  approval?: { status?: string } | null;
  _count?: { documents?: number };
};

type EmployeeExportRow = {
  employeeId: string;
  fullName: string;
  status: string;
  onboardingStage: number;
  department: string;
  jobTitle: string;
  approvalStatus: string;
  site: string;
  basicSalary: string;
  documentsCount: number;
};

type EmployeeBulkUpload = {
  employeeId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  fullName?: string;
  nickName?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
  mobile?: string;
  email?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  jobTitle?: string;
  department?: string;
  reportingTo?: string;
  employmentType?: string;
  contractType?: string;
  contractStart?: string;
  contractEnd?: string;
  probationMonths?: number;
  noticeDays?: number;
  status?: string;
  onboardingStage?: number;
};

const BULK_TEMPLATE_HEADERS = [
  "employeeId",
  "firstName",
  "middleName",
  "lastName",
  "fullName",
  "nickName",
  "nationality",
  "dateOfBirth",
  "gender",
  "mobile",
  "email",
  "emergencyName",
  "emergencyPhone",
  "jobTitle",
  "department",
  "reportingTo",
  "employmentType",
  "contractType",
  "contractStart",
  "contractEnd",
  "probationMonths",
  "noticeDays",
  "status",
  "onboardingStage",
] as const;

const BULK_TEMPLATE_SAMPLE_ROW: EmployeeBulkUpload = {
  employeeId: "EMP-1001",
  firstName: "Ali",
  middleName: "Ahmed",
  lastName: "Khan",
  fullName: "Ali Ahmed Khan",
  nickName: "Ali",
  nationality: "Pakistani",
  dateOfBirth: "1990-01-01",
  gender: "MALE",
  mobile: "+971500000000",
  email: "ali@example.com",
  emergencyName: "Sameer Khan",
  emergencyPhone: "+971511111111",
  jobTitle: "SECURITY_GUARD",
  department: "OPERATIONS",
  reportingTo: "OPS-LEAD-01",
  employmentType: "FULL_TIME",
  contractType: "LIMITED",
  contractStart: "2026-04-24",
  contractEnd: "",
  probationMonths: 6,
  noticeDays: 30,
  status: "PENDING_APPROVAL",
  onboardingStage: 1,
};

function formatEnum(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function toExportRows(rows: EmployeeRow[]): EmployeeExportRow[] {
  return rows.map((row) => ({
    employeeId: row.employeeId,
    fullName: row.fullName,
    status: row.status,
    onboardingStage: row.onboardingStage ?? 1,
    department: row.department,
    jobTitle: row.jobTitle,
    approvalStatus: row.approval?.status ?? "",
    site: row.siteAssignment?.site?.name ?? "",
    basicSalary: row.payrollConfig?.basicSalary != null ? String(row.payrollConfig.basicSalary) : "",
    documentsCount: row._count?.documents ?? 0,
  }));
}

function StatusBadge({ status }: { status: string }) {
  const base = "inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize";
  const s = status.toUpperCase();
  if (s === "ACTIVE" || s === "CONDITIONALLY_APPROVED") {
    return <span className={cn(base, "bg-emerald-100 text-emerald-900")}>{formatEnum(status)}</span>;
  }
  if (s === "DRAFT") {
    return <span className={cn(base, "bg-amber-100 text-amber-950")}>Draft</span>;
  }
  if (s === "PENDING_APPROVAL") {
    return <span className={cn(base, "bg-sky-100 text-sky-950")}>Pending approval</span>;
  }
  if (s === "REJECTED") {
    return <span className={cn(base, "bg-rose-100 text-rose-900")}>Rejected</span>;
  }
  if (s === "ON_EXIT") {
    return <span className={cn(base, "bg-orange-100 text-orange-950")}>On exit</span>;
  }
  return <span className={cn(base, "bg-slate-100 text-slate-800")}>{formatEnum(status)}</span>;
}

function FlagsCell({ row }: { row: EmployeeRow }) {
  const stage = row.onboardingStage ?? 1;
  if (row.status === "DRAFT") {
    return (
      <div className="flex flex-wrap gap-1">
        <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">Onboarding</span>
        <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
          Step {Math.min(6, Math.max(1, stage))}/6
        </span>
      </div>
    );
  }
  if (row.status === "PENDING_APPROVAL") {
    return (
      <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-950">
        Ops review
      </span>
    );
  }
  if (row.approval?.status === "PENDING") {
    return (
      <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
        Approval pending
      </span>
    );
  }
  if (row.status === "ACTIVE" && (row._count?.documents ?? 0) === 0) {
    return (
      <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
        No docs
      </span>
    );
  }
  return <span className="text-xs text-slate-400">—</span>;
}

export default function EmployeesPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isHr = role === ROLES.HR_ADMIN;

  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkEmployees, setBulkEmployees] = useState<EmployeeBulkUpload[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccess, setBulkSuccess] = useState("");

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((payload) => {
        if (Array.isArray(payload)) setRows(payload);
        else setError(payload?.error ?? "Unable to load employees");
      })
      .catch(() => setError("Unable to load employees"));
  }, []);

  const departments = useMemo(() => {
    const set = new Set(rows.map((r) => r.department).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => (statusFilter === "ALL" ? true : row.status === statusFilter))
      .filter((row) => (departmentFilter === "ALL" ? true : row.department === departmentFilter))
      .filter((row) => {
        const hay = `${row.fullName} ${row.employeeId} ${row.jobTitle}`.toLowerCase();
        return hay.includes(query.trim().toLowerCase());
      });
  }, [rows, statusFilter, departmentFilter, query]);

  async function refreshEmployees() {
    const response = await fetch("/api/employees");
    const payload = await response.json();
    if (!response.ok || !Array.isArray(payload)) {
      throw new Error(payload?.error ?? "Unable to load employees");
    }
    setRows(payload);
  }

  async function submitBulkEmployees() {
    setBulkError("");
    setBulkSuccess("");
    if (bulkEmployees.length === 0) {
      setBulkError("Upload a valid Excel file with at least one employee row.");
      return;
    }

    setBulkLoading(true);
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employees: bulkEmployees }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to create employees");
      }
      await refreshEmployees();
      setBulkEmployees([]);
      setUploadedFileName("");
      setBulkSuccess(`Created ${payload?.createdCount ?? bulkEmployees.length} employees successfully.`);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Unable to create employees");
    } finally {
      setBulkLoading(false);
    }
  }

  function downloadBulkTemplate() {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([BULK_TEMPLATE_SAMPLE_ROW], {
      header: [...BULK_TEMPLATE_HEADERS],
    });
    XLSX.utils.book_append_sheet(workbook, sheet, "Employees");
    XLSX.writeFile(workbook, "employee_bulk_template.xlsx");
  }

  async function handleBulkFileUpload(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error("Uploaded file has no worksheet.");
    }

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      throw new Error("No data rows found in the uploaded file.");
    }

    const normalized: EmployeeBulkUpload[] = rows.map((row, index) => {
      const firstName = String(row.firstName ?? "").trim();
      const lastName = String(row.lastName ?? "").trim();
      if (!firstName || !lastName) {
        throw new Error(`Row ${index + 2} is missing required fields: firstName and lastName.`);
      }
      return {
        employeeId: String(row.employeeId ?? "").trim() || undefined,
        firstName,
        middleName: String(row.middleName ?? "").trim() || undefined,
        lastName,
        fullName: String(row.fullName ?? "").trim() || undefined,
        nickName: String(row.nickName ?? "").trim() || undefined,
        nationality: String(row.nationality ?? "").trim() || undefined,
        dateOfBirth: String(row.dateOfBirth ?? "").trim() || undefined,
        gender: String(row.gender ?? "").trim() || undefined,
        mobile: String(row.mobile ?? "").trim() || undefined,
        email: String(row.email ?? "").trim() || undefined,
        emergencyName: String(row.emergencyName ?? "").trim() || undefined,
        emergencyPhone: String(row.emergencyPhone ?? "").trim() || undefined,
        jobTitle: String(row.jobTitle ?? "").trim() || undefined,
        department: String(row.department ?? "").trim() || undefined,
        reportingTo: String(row.reportingTo ?? "").trim() || undefined,
        employmentType: String(row.employmentType ?? "").trim() || undefined,
        contractType: String(row.contractType ?? "").trim() || undefined,
        contractStart: String(row.contractStart ?? "").trim() || undefined,
        contractEnd: String(row.contractEnd ?? "").trim() || undefined,
        probationMonths: row.probationMonths ? Number(row.probationMonths) : undefined,
        noticeDays: row.noticeDays ? Number(row.noticeDays) : undefined,
        status: String(row.status ?? "").trim() || undefined,
        onboardingStage: row.onboardingStage ? Number(row.onboardingStage) : undefined,
      };
    });

    setBulkEmployees(normalized);
    setUploadedFileName(file.name);
  }

  function downloadCsvExport() {
    if (filteredRows.length === 0) {
      setError("No employee data available to export.");
      return;
    }
    const exportRows = toExportRows(filteredRows);
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employees_export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadExcelExport() {
    if (filteredRows.length === 0) {
      setError("No employee data available to export.");
      return;
    }
    const exportRows = toExportRows(filteredRows);
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Employees");
    XLSX.writeFile(workbook, "employees_export.xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">Employees</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              Directory, onboarding drafts, and quick actions in one place.
            </p>
          </div>
          {isHr ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={downloadCsvExport}
              >
                Export CSV
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={downloadExcelExport}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => {
                  setShowBulkForm((prev) => !prev);
                  setBulkError("");
                  setBulkSuccess("");
                }}
              >
                Bulk add
              </button>
              <Link
                href="/employees/onboard"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add employee
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 bg-slate-50/80 px-4 py-3 md:flex-row md:flex-wrap md:items-center md:px-5">
          <div className="relative min-w-0 flex-1 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              placeholder="Search name, ID, or job title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search employees"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-[#3B82F6]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending approval</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_EXIT">On exit</option>
              <option value="REJECTED">Rejected</option>
            </select>
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-[#3B82F6]"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="ALL">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {formatEnum(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isHr && showBulkForm ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className="text-base font-semibold text-slate-900">Bulk add employees</h2>
          <p className="mt-1 text-sm text-slate-600">Paste one employee per line in this format: employeeId, firstName, middleName, lastName</p>
          <p className="mt-1 text-xs text-slate-500">
            Use `YYYY-MM-DD` for dates and DB enum values (example: `MALE`, `SECURITY_GUARD`, `FULL_TIME`).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={downloadBulkTemplate}
            >
              Download Excel format
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Upload Excel (.xlsx)
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBulkError("");
                  setBulkSuccess("");
                  handleBulkFileUpload(file).catch((err) => {
                    setBulkEmployees([]);
                    setUploadedFileName("");
                    setBulkError(err instanceof Error ? err.message : "Unable to read uploaded file");
                  });
                }}
              />
            </label>
          </div>
          {uploadedFileName ? (
            <p className="mt-2 text-sm text-slate-700">
              File: <span className="font-medium">{uploadedFileName}</span> ({bulkEmployees.length} rows ready)
            </p>
          ) : null}
          {bulkError ? <p className="mt-2 text-sm text-rose-700">{bulkError}</p> : null}
          {bulkSuccess ? <p className="mt-2 text-sm text-emerald-700">{bulkSuccess}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => {
                submitBulkEmployees().catch((err) => {
                  setBulkError(err instanceof Error ? err.message : "Unable to create employees");
                });
              }}
              disabled={bulkLoading}
            >
              {bulkLoading ? "Creating..." : "Create employees"}
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => {
                setBulkEmployees([]);
                setUploadedFileName("");
                setBulkError("");
                setBulkSuccess("");
              }}
              disabled={bulkLoading}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="whitespace-nowrap px-3 py-3">Employee</th>
                <th className="whitespace-nowrap px-3 py-3">Job</th>
                <th className="whitespace-nowrap px-3 py-3">Department</th>
                <th className="whitespace-nowrap px-3 py-3">Status</th>
                <th className="whitespace-nowrap px-3 py-3">Flags</th>
                <th className="whitespace-nowrap px-3 py-3">Approval</th>
                <th className="whitespace-nowrap px-3 py-3">Site</th>
                <th className="whitespace-nowrap px-3 py-3">Salary</th>
                <th className="whitespace-nowrap px-3 py-3">Docs</th>
                <th className="whitespace-nowrap px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-3 py-3 align-top">
                    <Link href={`/employees/${row.id}`} className="font-semibold text-blue-700 hover:underline">
                      {row.fullName}
                    </Link>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">{row.employeeId}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-800">{formatEnum(row.jobTitle)}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{formatEnum(row.department)}</td>
                  <td className="px-3 py-3 align-top">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="max-w-[140px] px-3 py-3 align-top">
                    <FlagsCell row={row} />
                  </td>
                  <td className="px-3 py-3 align-top text-slate-700">{row.approval?.status ? formatEnum(row.approval.status) : "—"}</td>
                  <td className="px-3 py-3 align-top text-slate-700">{row.siteAssignment?.site?.name ?? "Unassigned"}</td>
                  <td className="px-3 py-3 align-top tabular-nums text-slate-800">
                    {row.payrollConfig?.basicSalary != null ? `AED ${row.payrollConfig.basicSalary}` : "—"}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="tabular-nums text-slate-800">{row._count?.documents ?? 0}</div>
                    <Link href={`/employees/${row.id}/documents`} className="text-xs font-medium text-blue-600 hover:underline">
                      Review
                    </Link>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                      <Link
                        href={`/employees/${row.id}`}
                        className="inline-flex text-xs font-semibold text-blue-700 hover:underline"
                      >
                        Profile
                      </Link>
                      {isHr && row.status === "DRAFT" ? (
                        <Link
                          href={`/employees/onboard?resume=${row.id}`}
                          className="inline-flex text-xs font-semibold text-amber-800 hover:underline"
                        >
                          Resume onboarding
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && filteredRows.length === 0 && !error ? (
          <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">No employees match your filters.</p>
        ) : null}
        {rows.length === 0 && !error ? (
          <p className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-500">No employee records found.</p>
        ) : null}
      </div>
    </div>
  );
}
