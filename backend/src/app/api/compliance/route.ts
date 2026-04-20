import { prisma } from "@/src/lib/prisma";
import { forbiddenResponse, requireRoles, requireSessionContext, unauthorizedResponse } from "@/src/lib/session";
import { getCachedValue } from "@/src/lib/response-cache";
import { apiError } from "@/src/lib/api-error";

import { getDocumentAlertLevel } from "@/src/lib/compliance";
export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OPS_DIRECTOR", "SITE_SUPERVISOR", "OWNER"]);
    const docs = await getCachedValue(
      `compliance:list:${session.demoSessionId}`,
      8000,
      async () =>
        prisma.document.findMany({
          where: {
            employee: {
              demoSessionId: session.demoSessionId,
              ...(session.role === "SITE_SUPERVISOR"
                ? { siteAssignment: { site: { supervisorUserId: session.userId } } }
                : {}),
            },
          },
          select: {
            id: true,
            type: true,
            status: true,
            expiryDate: true,
            documentNumber: true,
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeId: true,
              },
            },
          },
          orderBy: { expiryDate: "asc" },
        }),
    );
    const decorated = docs.map((d) => ({
      ...d,
      alertLevel: d.expiryDate ? getDocumentAlertLevel(d.expiryDate, d.type) : "YELLOW",
    }));

    if (session.role === "SITE_SUPERVISOR") {
      const now = new Date();
      const byEmployee = new Map<
        string,
        {
          employee: { id: string; fullName: string; employeeId: string };
          overallStatus: "COMPLIANT" | "EXPIRING_SOON" | "OVERDUE";
          nearestExpiryDate: string | null;
          daysToExpiry: number | null;
          alertLevel: "RED" | "YELLOW" | "GREEN";
        }
      >();
      for (const doc of decorated) {
        if (!doc.employee?.id) continue;
        const key = doc.employee.id;
        const expiry = doc.expiryDate ? new Date(doc.expiryDate) : null;
        const daysToExpiry = expiry ? Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const status: "COMPLIANT" | "EXPIRING_SOON" | "OVERDUE" =
          doc.alertLevel === "RED" ? "OVERDUE" : doc.alertLevel === "YELLOW" ? "EXPIRING_SOON" : "COMPLIANT";
        const prev = byEmployee.get(key);
        if (!prev) {
          byEmployee.set(key, {
            employee: {
              id: doc.employee.id,
              fullName: doc.employee.fullName ?? "Employee",
              employeeId: doc.employee.employeeId ?? "",
            },
            overallStatus: status,
            nearestExpiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString() : null,
            daysToExpiry,
            alertLevel: doc.alertLevel,
          });
          continue;
        }
        const severityOrder = { COMPLIANT: 0, EXPIRING_SOON: 1, OVERDUE: 2 };
        if (severityOrder[status] > severityOrder[prev.overallStatus]) {
          prev.overallStatus = status;
          prev.alertLevel = doc.alertLevel;
        }
        if (daysToExpiry !== null && (prev.daysToExpiry === null || daysToExpiry < prev.daysToExpiry)) {
          prev.daysToExpiry = daysToExpiry;
          prev.nearestExpiryDate = doc.expiryDate ? new Date(doc.expiryDate).toISOString() : null;
        }
      }
      return Response.json(Array.from(byEmployee.values()));
    }

    return Response.json(decorated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return unauthorizedResponse();
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    return apiError("Unable to fetch compliance records", 400);
  }
}
