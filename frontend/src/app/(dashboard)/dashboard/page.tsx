import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { RoleDashboard } from "@/src/components/layout/RoleDashboard";
import { ROLES } from "@/src/lib/roles";
import { getRoleFromSession } from "@/src/lib/role-guard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session) ?? ROLES.HR_ADMIN;
  return <RoleDashboard role={role} />;
}
