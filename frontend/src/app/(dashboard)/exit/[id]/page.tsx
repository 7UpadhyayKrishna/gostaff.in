import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { ExitWizard } from "@/src/components/exit/ExitWizard";
import { getRoleFromSession } from "@/src/lib/role-guard";
import { canAccessPage } from "@/src/lib/permissions";

export default async function ExitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);
  if (!canAccessPage("/exit/[id]", role)) {
    return <AccessDenied message="You do not have access to this offboarding case." />;
  }
  const { id } = await params;
  return <ExitWizard exitId={id} />;
}
