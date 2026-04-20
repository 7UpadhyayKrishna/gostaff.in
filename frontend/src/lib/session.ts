import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
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
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}
