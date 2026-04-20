import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";
import { getLockSiteBlockers } from "@/src/lib/payroll-validations";

type Body = { siteId?: string; period?: string };

export async function POST(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN"], "Only HR can lock site timesheets");
    const body = (await req.json()) as Body;
    if (!body.siteId || !body.period) return apiError("siteId and period are required", 400);

    const blockers = await getLockSiteBlockers({
      demoSessionId: session.demoSessionId,
      siteId: body.siteId,
      period: body.period,
    });
    if (blockers.length > 0) {
      return Response.json(
        {
          success: false,
          error: "LOCK_SITE_VALIDATION_FAILED",
          message: "Cannot lock site-period until blockers are resolved.",
          blockers,
        },
        { status: 409 },
      );
    }

    await prisma.timesheet.updateMany({
      where: {
        period: body.period,
        employee: {
          demoSessionId: session.demoSessionId,
          siteAssignment: { siteId: body.siteId },
        },
      },
      data: { status: "LOCKED", lockedAt: new Date(), validatedAt: new Date(), validatedByUserId: session.userId },
    });

    const submission = await prisma.siteTimesheetSubmission.upsert({
      where: { demoSessionId_siteId_period: { demoSessionId: session.demoSessionId, siteId: body.siteId, period: body.period } },
      update: {
        status: "LOCKED",
        validatedAt: new Date(),
        lockedAt: new Date(),
        validatedByUserId: session.userId,
        note: null,
      },
      create: {
        demoSessionId: session.demoSessionId,
        siteId: body.siteId,
        period: body.period,
        status: "LOCKED",
        validatedAt: new Date(),
        lockedAt: new Date(),
        validatedByUserId: session.userId,
      },
    });

    return Response.json(submission);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to lock site timesheets", 400);
  }
}
