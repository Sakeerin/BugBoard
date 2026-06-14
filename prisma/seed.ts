import { PrismaClient, Priority, Status, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.issue.deleteMany();
  await prisma.user.deleteMany();

  const adminHash = await bcrypt.hash("admin123", 10);
  const memberHash = await bcrypt.hash("member123", 10);

  const [admin, alice, bob] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Admin User",
        email: "admin@bugboard.dev",
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        name: "Alice Dev",
        email: "alice@bugboard.dev",
        passwordHash: memberHash,
        role: Role.MEMBER,
      },
    }),
    prisma.user.create({
      data: {
        name: "Bob Dev",
        email: "bob@bugboard.dev",
        passwordHash: memberHash,
        role: Role.MEMBER,
      },
    }),
  ]);

  const issues: Array<{
    title: string;
    description: string;
    priority: Priority;
    status: Status;
    reporterId: string;
    assigneeId?: string;
  }> = [
    {
      title: "Login page crashes on empty password",
      description:
        "When a user submits the login form with an empty password field, the app throws an unhandled exception and crashes. Expected: show validation error instead.",
      priority: Priority.critical,
      status: Status.open,
      reporterId: alice.id,
      assigneeId: bob.id,
    },
    {
      title: "API rate limit not enforced",
      description:
        "The /api/issues endpoint has no rate limiting. A malicious user can flood it with thousands of requests per minute, causing denial of service.",
      priority: Priority.critical,
      status: Status.in_progress,
      reporterId: admin.id,
      assigneeId: alice.id,
    },
    {
      title: "Issue list does not update after status change",
      description:
        "After marking an issue as resolved via the PATCH endpoint, the frontend list still shows the old status until a full page refresh is performed.",
      priority: Priority.high,
      status: Status.open,
      reporterId: bob.id,
      assigneeId: alice.id,
    },
    {
      title: "Seed script fails on clean database",
      description:
        "Running prisma db seed on a freshly migrated database with no existing users fails with a foreign key constraint error because issue creation runs before user creation completes.",
      priority: Priority.high,
      status: Status.in_progress,
      reporterId: alice.id,
      assigneeId: admin.id,
    },
    {
      title: "Add dark mode support",
      description:
        "Users have requested a dark mode toggle in the settings panel. Should persist preference in localStorage and apply via a CSS class on the root element.",
      priority: Priority.medium,
      status: Status.resolved,
      reporterId: bob.id,
      assigneeId: bob.id,
    },
    {
      title: "Update README with setup instructions",
      description:
        "The project README is missing Docker Compose and database migration steps. New contributors are confused about how to get the local environment running.",
      priority: Priority.low,
      status: Status.resolved,
      reporterId: admin.id,
      assigneeId: admin.id,
    },
  ];

  for (const issue of issues) {
    await prisma.issue.create({ data: issue });
  }

  console.log(`Seeded:`);
  console.log(`  Users: admin@bugboard.dev (ADMIN), alice@bugboard.dev (MEMBER), bob@bugboard.dev (MEMBER)`);
  console.log(`  Issues: 6 total — 2 open, 2 in_progress, 2 resolved | 2 critical, 2 high, 1 medium, 1 low`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
