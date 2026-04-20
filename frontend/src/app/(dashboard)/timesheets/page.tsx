import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { TimesheetsPageClient } from "@/src/components/payroll/TimesheetsPageClient";
import { getRoleFromSession } from "@/src/lib/role-guard";
import { canAccessPage } from "@/src/lib/permissions";

export default async function TimesheetsPage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);

  if (!canAccessPage("/timesheets", role)) {
    return <AccessDenied message="You do not have access to timesheets." />;
  }

  return <TimesheetsPageClient />;
}
