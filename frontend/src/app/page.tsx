import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { ROLES, type AppRole } from "@/src/lib/roles";
import { getRoleFromSession } from "@/src/lib/role-guard";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (getRoleFromSession(session) ?? ROLES.HR_ADMIN) as AppRole;
  if (role === ROLES.OWNER) redirect("/dashboard");
  if (role === ROLES.HR_ADMIN) redirect("/employees");
  if (role === ROLES.OPS_DIRECTOR) redirect("/approvals");
  if (role === ROLES.SITE_SUPERVISOR) redirect("/timesheets");
  redirect("/dashboard");
}
