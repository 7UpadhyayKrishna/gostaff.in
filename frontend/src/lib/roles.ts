export const ROLES = {
  OWNER: "OWNER",
  HR_ADMIN: "HR_ADMIN",
  OPS_DIRECTOR: "OPS_DIRECTOR",
  SITE_SUPERVISOR: "SITE_SUPERVISOR",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** Human-readable names shown in UI (Topbar, dashboards, etc.). */
export const ROLE_LABELS: Record<AppRole, string> = {
  OWNER: "Owner",
  HR_ADMIN: "HR",
  OPS_DIRECTOR: "Operation",
  SITE_SUPERVISOR: "Supervisor",
};
