import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function main() {
  const seedExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.demoSession.create({ data: { expiresAt: seedExpiresAt } });

  await prisma.user.create({
    data: {
      name: "Owner",
      email: "owner@demo.com",
      role: UserRole.OWNER,
      passwordHash: await bcrypt.hash("owner123", 10),
      demoSessionId: session.id,
    },
  });

  await prisma.user.create({
    data: {
      name: "HR Admin",
      email: "hr@demo.com",
      role: UserRole.HR_ADMIN,
      passwordHash: await bcrypt.hash("hr123", 10),
      demoSessionId: session.id,
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      name: "Site Supervisor",
      email: "supervisor@demo.com",
      role: UserRole.SITE_SUPERVISOR,
      passwordHash: await bcrypt.hash("supervisor123", 10),
      demoSessionId: session.id,
    },
  });

  const site = await prisma.site.create({
    data: {
      name: "Main Demo Site",
      location: "Dubai",
      supervisorUserId: supervisor.id,
    },
  });

  await prisma.shift.createMany({
    data: [
      {
        demoSessionId: session.id,
        siteId: site.id,
        name: "Morning",
        startTime: "06:00",
        endTime: "14:00",
      },
      {
        demoSessionId: session.id,
        siteId: site.id,
        name: "Evening",
        startTime: "14:00",
        endTime: "22:00",
      },
      {
        demoSessionId: session.id,
        siteId: site.id,
        name: "Night",
        startTime: "22:00",
        endTime: "06:00",
      },
    ],
  });
}

main().finally(async () => prisma.$disconnect());
