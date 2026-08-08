"use client";

import { useEffect, useRef } from "react";
import type { IssueEvent } from "@/lib/events";

interface StreamHandlers {
  /** Fired for every well-formed issue event. */
  onEvent: (e: IssueEvent) => void;
  /**
   * Fired whenever the stream (re)opens. Events emitted while the tab was
   * disconnected are never replayed by the in-memory bus, so the caller must
   * refetch the full list here to recover missed create/update/delete events.
   */
  onOpen?: () => void;
  /**
   * Fired when the connection fails terminally (readyState === CLOSED), e.g.
   * the server answered the reconnect with a non-2xx such as 401 after the
   * session expired. Per the EventSource spec this stops auto-reconnect, so
   * realtime is dead until the caller intervenes (typically redirect to login).
   */
  onFatal?: () => void;
}

export function useIssueStream({ onEvent, onOpen, onFatal }: StreamHandlers) {
  const saved = useRef({ onEvent, onOpen, onFatal });

  useEffect(() => {
    saved.current = { onEvent, onOpen, onFatal };
  });

  useEffect(() => {
    const es = new EventSource("/api/issues/stream");

    // Fires on the first connect AND after every automatic reconnect. We resync
    // on every open (including the first) to also close the gap between the RSC
    // snapshot and the stream actually connecting after hydration.
    es.onopen = () => saved.current.onOpen?.();

    es.onmessage = ({ data }) => {
      try {
        saved.current.onEvent(JSON.parse(data) as IssueEvent);
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      // CLOSED => the browser will NOT retry (server rejected the connection,
      // e.g. 401). CONNECTING => a transient blip; the browser auto-reconnects
      // and onopen will resync, so nothing to do here.
      if (es.readyState === EventSource.CLOSED) {
        saved.current.onFatal?.();
      }
    };

    return () => es.close();
  }, []); // open once; latest callbacks always reached via ref
}
