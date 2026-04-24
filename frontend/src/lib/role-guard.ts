import type { Session } from "next-auth";
import { ROLES, type AppRole } from "@/src/lib/roles";

export function getRoleFromSession(session: Session | null | undefined): AppRole | undefined {
  const role = (session?.user as { role?: string } | undefined)?.role;
  return normalizeToAppRole(role);
}

export function hasRequiredRole(
  role: AppRole | string | undefined,
  allowedRoles: readonly AppRole[],
): role is AppRole {
  return !!role && allowedRoles.includes(role as AppRole);
}

function isAppRole(role: string | undefined): role is AppRole {
  return !!role && Object.values(ROLES).includes(role as AppRole);
}

function normalizeToAppRole(role: string | undefined): AppRole | undefined {
  if (!role) return undefined;
  if (isAppRole(role)) return role;

  const normalized = role.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return isAppRole(normalized) ? normalized : undefined;
}
