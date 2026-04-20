import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { ExitPageClient } from "@/src/components/exit/ExitPageClient";
import { getRoleFromSession } from "@/src/lib/role-guard";
import { canAccessPage } from "@/src/lib/permissions";

export default async function ExitPage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);

  if (!canAccessPage("/exit", role)) {
    return <AccessDenied message="HR role is required for offboarding workflows." />;
  }

  return <ExitPageClient />;
}
