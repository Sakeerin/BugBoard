import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getIssues, getUsers } from "@/lib/db";
import Dashboard from "@/components/Dashboard";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [issues, users] = await Promise.all([getIssues(), getUsers()]);

  return (
    <Dashboard initialIssues={issues} session={session} users={users} />
  );
}
