import type { Session } from "next-auth";
import { ROLES, type AppRole } from "@/src/lib/roles";

export function getRoleFromSession(session: Session | null | undefined): AppRole | undefined {
  const role = (session?.user as { role?: string } | undefined)?.role;
  return isAppRole(role) ? role : undefined;
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
