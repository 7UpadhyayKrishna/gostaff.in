import { Sidebar } from "@/src/components/layout/Sidebar";
import { Topbar } from "@/src/components/layout/Topbar";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/src/lib/auth";
import { ROLES, type AppRole } from "@/src/lib/roles";
import { getRoleFromSession } from "@/src/lib/role-guard";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = (getRoleFromSession(session) ?? ROLES.HR_ADMIN) as AppRole;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Topbar role={role} />
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-3 pb-4 pt-3 md:px-5 lg:flex-row lg:px-6">
        <Sidebar role={role} />
        <main className="flex-1 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm md:p-6">{children}</main>
      </div>
    </div>
  );
}
