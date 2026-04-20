import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { PayrollPageClient } from "@/src/components/payroll/PayrollPageClient";
import { getRoleFromSession } from "@/src/lib/role-guard";
import { canAccessPage } from "@/src/lib/permissions";

export default async function PayrollPage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);

  if (!canAccessPage("/payroll", role)) {
    return <AccessDenied message="You do not have access to payroll." />;
  }

  return <PayrollPageClient />;
}
