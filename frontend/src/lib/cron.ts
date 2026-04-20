import cron from "node-cron";
import { prisma } from "@/src/lib/prisma";

const DEMO_LIFETIME_HOURS = Number(process.env.DEMO_SESSION_HOURS ?? 2.5);

export function startDemoCronJob() {
  cron.schedule("*/15 * * * *", async () => {
    const cutoff = new Date(Date.now() - DEMO_LIFETIME_HOURS * 60 * 60 * 1000);
    const expiredSessions = await prisma.demoSession.findMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { createdAt: { lt: cutoff } }] },
      select: { id: true },
    });
    if (!expiredSessions.length) return;
    await prisma.demoSession.deleteMany({ where: { id: { in: expiredSessions.map((s) => s.id) } } });
  });
}
