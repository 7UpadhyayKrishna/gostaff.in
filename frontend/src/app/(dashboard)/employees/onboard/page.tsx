import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/src/lib/auth";
import { AccessDenied } from "@/src/components/layout/AccessDenied";
import { OnboardingWizard } from "@/src/components/onboarding/OnboardingWizard";
import { canAccessPage } from "@/src/lib/permissions";
import { getRoleFromSession } from "@/src/lib/role-guard";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const role = getRoleFromSession(session);
  if (!canAccessPage("/employees/onboard", role)) {
    return <AccessDenied message="HR role is required to onboard employees." />;
  }
  return (
    <Suspense fallback={<p className="text-sm text-slate-600">Loading onboarding…</p>}>
      <OnboardingWizard />
    </Suspense>
  );
}
