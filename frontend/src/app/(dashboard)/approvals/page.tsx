import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { ApprovalQueue } from "@/src/components/approvals/ApprovalQueue";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { canAccessPage } from "@/src/lib/permissions";
import { getRoleFromSession } from "@/src/lib/role-guard";

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);
  if (!canAccessPage("/approvals", role)) {
    return <AccessDenied message="Operation role is required to approve onboarding." />;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Operation approval gate</h2>
      <p className="text-sm text-slate-600">Approve, reject, or flag onboarding submissions for HR review.</p>
      <ApprovalQueue />
    </div>
  );
}
