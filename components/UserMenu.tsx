"use client";

import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

const roleLabel: Record<string, string> = {
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default function UserMenu({ session }: { session: Session }) {
  const user = session.user;
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "??";

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {initials}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium leading-none">{user.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {roleLabel[user.role] ?? user.role}
          </p>
        </div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      >
        Sign out
      </button>
    </div>
  );
}
