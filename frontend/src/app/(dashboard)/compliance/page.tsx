import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { CompliancePageClient } from "@/src/components/compliance/CompliancePageClient";
import { getRoleFromSession } from "@/src/lib/role-guard";
import { canAccessPage } from "@/src/lib/permissions";

export default async function CompliancePage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);
  if (!canAccessPage("/compliance", role)) {
    return <AccessDenied message="You do not have access to compliance monitoring." />;
  }

  return <CompliancePageClient />;
}
