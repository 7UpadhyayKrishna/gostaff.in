import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { apiError } from "@/src/lib/api-error";
import type { AppRole } from "@/src/lib/roles";

export type SessionContext = {
  userId: string;
  role: AppRole;
  demoSessionId: string;
};

export async function requireSessionContext(): Promise<SessionContext> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: SessionContext["role"]; demoSessionId?: string } | undefined;

  if (!session || !user?.id || !user?.role || !user?.demoSessionId) {
    throw new Error("UNAUTHORIZED");
  }

  return {
    userId: user.id,
    role: user.role,
    demoSessionId: user.demoSessionId,
  };
}

export function unauthorizedResponse() {
  return apiError("Unauthorized", 401);
}

export function forbiddenResponse(message = "Forbidden") {
  return apiError(message, 403);
}

export function hasRole(session: SessionContext, roles: SessionContext["role"][]) {
  return roles.includes(session.role);
}

export function requireRoles(
  session: SessionContext,
  roles: SessionContext["role"][],
  message = "Forbidden",
) {
  if (!hasRole(session, roles)) throw new Error(`FORBIDDEN:${message}`);
}
