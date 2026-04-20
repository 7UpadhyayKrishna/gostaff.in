import { DocumentType } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const month = new Date().toISOString().slice(0, 7);

    const [pendingApprovals, activeEmployees, exitsInProgress, payrollRunsThisMonth, onboardingDocCandidates] =
      await prisma.$transaction([
        prisma.approval.count({
          where: {
            status: "PENDING",
            employee: { demoSessionId: session.demoSessionId },
          },
        }),
        prisma.employee.count({
          where: { demoSessionId: session.demoSessionId, status: "ACTIVE" },
        }),
        prisma.exitRecord.count({
          where: {
            exitStatus: { not: "COMPLETED" },
            employee: { demoSessionId: session.demoSessionId },
          },
        }),
        prisma.payrollRun.count({
          where: { demoSessionId: session.demoSessionId, month },
        }),
        prisma.employee.findMany({
          where: {
            demoSessionId: session.demoSessionId,
            status: { in: ["DRAFT", "PENDING_APPROVAL"] },
          },
          select: {
            documents: { select: { type: true, fileUrl: true, uploadDeferredRemark: true } },
          },
        }),
      ]);

    let supervisorHeadcount = 0;
    let supervisorExpiringDocs30d = 0;
    let supervisorSubmissionSubmitted = 0;
    let supervisorSubmissionPending = 0;
    let supervisorSubmissionOverdue = 0;

    if (session.role === "SITE_SUPERVISOR") {
      const now = new Date();
      const in30 = new Date(now);
      in30.setDate(in30.getDate() + 30);
      const siteIds = await prisma.site.findMany({
        where: { supervisorUserId: session.userId },
        select: { id: true },
      });
      const supervisedSiteIds = siteIds.map((s) => s.id);
      supervisorHeadcount = await prisma.employee.count({
        where: {
          demoSessionId: session.demoSessionId,
          status: "ACTIVE",
          siteAssignment: { siteId: { in: supervisedSiteIds } },
        },
      });
      supervisorExpiringDocs30d = await prisma.document.count({
        where: {
          employee: {
            demoSessionId: session.demoSessionId,
            siteAssignment: { siteId: { in: supervisedSiteIds } },
          },
          expiryDate: {
            gte: now,
            lte: in30,
          },
          status: { in: ["EXPIRING_SOON", "UPLOADED", "PENDING"] },
        },
      });

      const submissions = await prisma.siteTimesheetSubmission.findMany({
        where: {
          demoSessionId: session.demoSessionId,
          period: month,
          siteId: { in: supervisedSiteIds },
        },
        select: { status: true, submittedAt: true },
      });
      const hasSubmission = submissions.length > 0;
      supervisorSubmissionSubmitted = submissions.filter((s) => s.status === "SUBMITTED" || s.status === "LOCKED").length;
      supervisorSubmissionPending = submissions.filter((s) => s.status === "DRAFT").length;
      supervisorSubmissionOverdue = hasSubmission
        ? submissions.filter((s) => !s.submittedAt && s.status === "DRAFT").length
        : supervisedSiteIds.length;
    }

    const docReady = (
      docs: { type: DocumentType; fileUrl: string | null; uploadDeferredRemark: string | null }[],
      t: DocumentType,
    ) =>
      docs.some(
        (d) =>
          d.type === t &&
          ((d.fileUrl != null && String(d.fileUrl).trim().length > 0) ||
            (d.uploadDeferredRemark != null && String(d.uploadDeferredRemark).trim().length > 0)),
      );

    const missingOnboardingDocs = onboardingDocCandidates.filter(
      (e) => !docReady(e.documents, "PASSPORT") || !docReady(e.documents, "EMIRATES_ID"),
    ).length;

    return Response.json({
      pendingApprovals,
      activeEmployees,
      exitsInProgress,
      payrollRunsThisMonth,
      missingOnboardingDocs,
      supervisorHeadcount,
      supervisorExpiringDocs30d,
      supervisorSubmissionSubmitted,
      supervisorSubmissionPending,
      supervisorSubmissionOverdue,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch dashboard overview", 400);
  }
}
