import { startDemoCronJob } from "@/src/lib/cron";
import { apiError } from "@/src/lib/api-error";
import {
  forbiddenResponse,
  requireRoles,
  requireSessionContext,
  unauthorizedResponse,
} from "@/src/lib/session";

let started = false;

export async function GET() {
  try {
    const session = await requireSessionContext();
    requireRoles(session, ["HR_ADMIN", "OWNER"], "Forbidden");

    if (!started) {
      startDemoCronJob();
      started = true;
    }

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message.startsWith("FORBIDDEN:")) {
      return forbiddenResponse(error.message.replace("FORBIDDEN:", ""));
    }
    return apiError("Internal server error", 500);
  }
}
