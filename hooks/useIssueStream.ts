"use client";

import { useEffect, useRef } from "react";
import type { IssueEvent } from "@/lib/events";

export function useIssueStream(onEvent: (e: IssueEvent) => void) {
  const savedCallback = useRef(onEvent);

  useEffect(() => {
    savedCallback.current = onEvent;
  });

  useEffect(() => {
    const es = new EventSource("/api/issues/stream");

    es.onmessage = ({ data }) => {
      try {
        savedCallback.current(JSON.parse(data) as IssueEvent);
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      // EventSource reconnects automatically — nothing to do
    };

    return () => es.close();
  }, []); // open once; latest callback always reached via ref
}
