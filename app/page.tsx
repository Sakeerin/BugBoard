import { getIssueStats } from "@/lib/db";

export default async function HomePage() {
  const stats = await getIssueStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">BugBoard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Phase A complete — database connected via Prisma + MySQL
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Open" value={stats.open} color="text-blue-600" />
        <StatCard label="In Progress" value={stats.in_progress} color="text-yellow-600" />
        <StatCard label="Resolved" value={stats.resolved} color="text-green-600" />
        <StatCard label="Critical" value={stats.critical} color="text-red-600" />
      </div>

      <p className="text-xs text-gray-400">
        Auth, issue CRUD, real-time updates and delete coming in Phases B–D.
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
