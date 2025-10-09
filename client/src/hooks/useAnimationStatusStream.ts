import { useEffect, useState } from "react";
import type { AnimationJobRecord } from "@shared/events";

type ConnectionState = "connecting" | "connected" | "disconnected";

interface UseAnimationStatusStreamOptions {
  enabled?: boolean;
  onStatus?: (job: AnimationJobRecord) => void;
  onSnapshot?: (jobs: AnimationJobRecord[]) => void;
}

function createListener<T>(handler?: (payload: T) => void, label?: string): EventListener {
  return (event) => {
    if (!handler) {
      return;
    }

    try {
      const message = event as MessageEvent<string>;
      const payload = JSON.parse(message.data) as T;
      handler(payload);
    } catch (error) {
      console.warn(`Failed to parse animation stream ${label ?? "event"}:`, error);
    }
  };
}

export function useAnimationStatusStream(options: UseAnimationStatusStreamOptions = {}) {
  const { enabled = true, onStatus, onSnapshot } = options;
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    enabled ? "connecting" : "disconnected",
  );

  useEffect(() => {
    if (!enabled) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connecting");

    const eventSource = new EventSource("/api/animation-jobs/stream", {
      withCredentials: true,
    });

    const statusListener = createListener<AnimationJobRecord>(onStatus, "status");
    const snapshotListener = createListener<AnimationJobRecord[]>(onSnapshot, "snapshot");

    eventSource.addEventListener("status", statusListener);
    eventSource.addEventListener("snapshot", snapshotListener);
    eventSource.onopen = () => setConnectionState("connected");
    eventSource.onerror = () => setConnectionState("disconnected");

    return () => {
      setConnectionState("disconnected");
      eventSource.removeEventListener("status", statusListener);
      eventSource.removeEventListener("snapshot", snapshotListener);
      eventSource.close();
    };
  }, [enabled, onSnapshot, onStatus]);

  return { connectionState };
}
