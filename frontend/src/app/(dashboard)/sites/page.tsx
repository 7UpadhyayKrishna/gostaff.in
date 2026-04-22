import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { SitesPageClient } from "@/src/components/layout/SitesPageClient";
import { getRoleFromSession } from "@/src/lib/role-guard";
import { canAccessPage } from "@/src/lib/permissions";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);
  if (!role || !canAccessPage("/sites", role)) {
    return <AccessDenied message="You do not have access to site management." />;
  }
  return <SitesPageClient role={role} />;
}
