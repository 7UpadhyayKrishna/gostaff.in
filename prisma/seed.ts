import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function main() {
  const seedExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const existingSession = await prisma.demoSession.findFirst({
    orderBy: { createdAt: "desc" },
  });
  const session =
    existingSession ??
    (await prisma.demoSession.create({
      data: { expiresAt: seedExpiresAt },
    }));

  await prisma.user.upsert({
    where: { email: "owner@demo.com" },
    update: {
      name: "Owner",
      role: UserRole.OWNER,
      passwordHash: await bcrypt.hash("owner123", 10),
      demoSessionId: session.id,
    },
    create: {
      name: "Owner",
      email: "owner@demo.com",
      role: UserRole.OWNER,
      passwordHash: await bcrypt.hash("owner123", 10),
      demoSessionId: session.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "hr@demo.com" },
    update: {
      name: "HR Admin",
      role: UserRole.HR_ADMIN,
      passwordHash: await bcrypt.hash("hr123", 10),
      demoSessionId: session.id,
    },
    create: {
      name: "HR Admin",
      email: "hr@demo.com",
      role: UserRole.HR_ADMIN,
      passwordHash: await bcrypt.hash("hr123", 10),
      demoSessionId: session.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "ops@demo.com" },
    update: {
      name: "Operations Director",
      role: UserRole.OPS_DIRECTOR,
      passwordHash: await bcrypt.hash("ops123", 10),
      demoSessionId: session.id,
    },
    create: {
      name: "Operations Director",
      email: "ops@demo.com",
      role: UserRole.OPS_DIRECTOR,
      passwordHash: await bcrypt.hash("ops123", 10),
      demoSessionId: session.id,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@demo.com" },
    update: {
      name: "Site Supervisor",
      role: UserRole.SITE_SUPERVISOR,
      passwordHash: await bcrypt.hash("supervisor123", 10),
      demoSessionId: session.id,
    },
    create: {
      name: "Site Supervisor",
      email: "supervisor@demo.com",
      role: UserRole.SITE_SUPERVISOR,
      passwordHash: await bcrypt.hash("supervisor123", 10),
      demoSessionId: session.id,
    },
  });

  await prisma.site.create({
    data: {
      name: "Main Demo Site",
      location: "Dubai",
      supervisorUserId: supervisor.id,
    },
  });
}

main().finally(async () => prisma.$disconnect());
