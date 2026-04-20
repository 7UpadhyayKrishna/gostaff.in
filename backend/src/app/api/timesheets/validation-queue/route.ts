import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { apiError } from "@/src/lib/api-error";

function parseDayLocks(note: string | null) {
  if (!note) return [] as string[];
  try {
    const parsed = JSON.parse(note) as { dayLocks?: string[] };
    return Array.isArray(parsed.dayLocks) ? parsed.dayLocks.filter((d) => typeof d === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "OWNER", "SITE_SUPERVISOR"]);
    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? new Date().toISOString().slice(0, 7);

    const sites = await prisma.site.findMany({
      where: session.role === "SITE_SUPERVISOR" ? { supervisorUserId: session.userId } : undefined,
      include: {
        supervisor: { select: { id: true, name: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { name: "asc" },
    });

    const submissions = await prisma.siteTimesheetSubmission.findMany({
      where: { demoSessionId: session.demoSessionId, period },
      select: { siteId: true, status: true, submittedAt: true, note: true },
    });
    const subMap = new Map(submissions.map((s) => [s.siteId, s]));

    const docExpiredEmployees = await prisma.document.findMany({
      where: {
        status: "EXPIRED",
        employee: { demoSessionId: session.demoSessionId, siteAssignment: { isNot: null } },
      },
      select: { employeeId: true, employee: { select: { siteAssignment: { select: { siteId: true } } } } },
    });
    const expiredBySite = new Map<string, number>();
    for (const d of docExpiredEmployees) {
      const siteId = d.employee.siteAssignment?.siteId;
      if (!siteId) continue;
      expiredBySite.set(siteId, (expiredBySite.get(siteId) ?? 0) + 1);
    }

    const queue = sites.map((site) => {
      const sub = subMap.get(site.id);
      return {
        siteId: site.id,
        siteName: site.name,
        location: site.location,
        supervisor: site.supervisor,
        assignedEmployees: site._count.assignments,
        period,
        submissionStatus: sub?.status ?? "DRAFT",
        submittedAt: sub?.submittedAt ?? null,
        dayLocks: parseDayLocks(sub?.note ?? null),
        expiredEmployeeCount: expiredBySite.get(site.id) ?? 0,
        hasComplianceBlocker: (expiredBySite.get(site.id) ?? 0) > 0,
      };
    });

    return Response.json(queue);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch validation queue", 400);
  }
}
