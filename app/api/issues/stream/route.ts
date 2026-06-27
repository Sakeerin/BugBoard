import { auth } from "@/auth";
import { onIssueEvent, type IssueEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (e: IssueEvent) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // controller closed — cancel() will clean up
        }
      };

      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      const off = onIssueEvent(send);

      cleanup = () => {
        off();
        clearInterval(ping);
      };
    },
    cancel() {
      cleanup?.();
    },
  });

  request.signal.addEventListener("abort", () => cleanup?.());

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
