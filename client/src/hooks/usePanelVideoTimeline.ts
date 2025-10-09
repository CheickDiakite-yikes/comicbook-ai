import { useQuery } from "@tanstack/react-query";
import type { PanelVideoQaResult, PanelVideoVersion } from "@shared/schema";

export interface PanelVideoTimelineEntry {
  version: PanelVideoVersion;
  qaResult?: PanelVideoQaResult | null;
}

export interface PanelVideoTimelineResponse {
  panelId: string;
  timeline: PanelVideoTimelineEntry[];
}

export function usePanelVideoTimeline(panelId?: string | null) {
  return useQuery<PanelVideoTimelineResponse>({
    queryKey: ["/api/panels", panelId, "video-qa"],
    enabled: Boolean(panelId),
  });
}
