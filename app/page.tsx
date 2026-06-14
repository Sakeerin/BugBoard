import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getIssues, getIssueStats, getUsers } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [issues, stats, users] = await Promise.all([
    getIssues(),
    getIssueStats(),
    getUsers(),
  ]);

  return (
    <Dashboard
      initialIssues={issues}
      initialStats={stats}
      session={session}
      users={users}
    />
  );
}
