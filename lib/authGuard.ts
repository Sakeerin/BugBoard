import type { Session } from "next-auth";
import type { NextResponse } from "next/server";
import { auth } from "@/auth";
import { errorResponse } from "@/lib/apiErrors";

type Guard =
  | { session: Session; response: null }
  | { session: null; response: NextResponse };

/**
 * Resolve the current session for an API route handler, or produce a 401.
 *
 *   const { session, response } = await requireUser();
 *   if (!session) return response;   // session is now narrowed to Session
 */
export async function requireUser(): Promise<Guard> {
  const session = await auth();
  if (!session?.user) {
    return { session: null, response: errorResponse("Unauthorized", 401) };
  }
  return { session, response: null };
}
