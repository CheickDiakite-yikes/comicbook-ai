export type AnimationJobStatus = "queued" | "rendering" | "completed" | "error";

export interface AnimationJobProgress {
  /** Percentage completion between 0 and 100. */
  percentage?: number;
  /** High level stage description, e.g. "Drafting keyframes". */
  stage?: string;
  /** Optional estimated seconds remaining. */
  etaSeconds?: number;
  /** Rendered frame count for progress visualisations. */
  framesRendered?: number;
  /** Total expected frames for the job. */
  totalFrames?: number;
  /** Additional free-form message from the renderer. */
  message?: string;
}

export interface AnimationJobHistoryEntry {
  status: AnimationJobStatus;
  timestamp: string;
  progress?: AnimationJobProgress;
  error?: string;
}

export interface AnimationJobRecord {
  jobId: string;
  userId: string;
  panelId: string;
  versionId: string;
  status: AnimationJobStatus;
  progress?: AnimationJobProgress;
  error?: string;
  attempts: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  history: AnimationJobHistoryEntry[];
}

export interface AnimationJobUpdate {
  jobId: string;
  userId: string;
  panelId: string;
  versionId: string;
  status: AnimationJobStatus;
  progress?: AnimationJobProgress;
  error?: string;
  metadata?: Record<string, unknown>;
}
