import { prisma } from "@/src/lib/prisma";
const DEMO_HOURS = Number(process.env.DEMO_SESSION_HOURS ?? 2.5);

export async function createDemoSession() {
  return prisma.demoSession.create({
    data: { expiresAt: new Date(Date.now() + DEMO_HOURS * 60 * 60 * 1000) },
  });
}

export async function getDemoTimeRemaining(sessionId: string) {
  const session = await prisma.demoSession.findUnique({ where: { id: sessionId } });
  if (!session) return 0;
  return Math.max(0, session.expiresAt.getTime() - Date.now());
}
