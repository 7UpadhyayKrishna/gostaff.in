import { ROLES, type AppRole } from "@/src/lib/roles";

export const PAGE_ACCESS = {
  "/dashboard": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR, ROLES.SITE_SUPERVISOR],
  "/employees": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR, ROLES.SITE_SUPERVISOR],
  "/employees/onboard": [ROLES.HR_ADMIN],
  "/approvals": [ROLES.OPS_DIRECTOR],
  "/timesheets": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR, ROLES.SITE_SUPERVISOR],
  "/payroll": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR],
  "/compensation": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR],
  "/sites": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR, ROLES.SITE_SUPERVISOR],
  "/compliance": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR, ROLES.SITE_SUPERVISOR],
  "/exit": [ROLES.HR_ADMIN],
  "/exit/[id]": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR],
  "/employees/[id]/exit": [ROLES.HR_ADMIN],
  "/employees/[id]/payroll": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR],
  "/payroll/[runId]": [ROLES.OWNER, ROLES.HR_ADMIN, ROLES.OPS_DIRECTOR],
} as const satisfies Record<string, readonly AppRole[]>;

export function canAccessPage(path: keyof typeof PAGE_ACCESS, role: AppRole | undefined): boolean {
  if (!role) return false;
  const allowedRoles: readonly AppRole[] = PAGE_ACCESS[path];
  return allowedRoles.includes(role);
}
