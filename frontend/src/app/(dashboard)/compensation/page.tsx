import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { CompensationPageClient } from "@/src/components/compensation/CompensationPageClient";
import { canAccessPage } from "@/src/lib/permissions";
import { getRoleFromSession } from "@/src/lib/role-guard";

export default async function CompensationPage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);

  if (!canAccessPage("/compensation", role)) {
    return <AccessDenied message="HR, Operation, or Owner role is required for compensation accrual." />;
  }

  return <CompensationPageClient />;
}
