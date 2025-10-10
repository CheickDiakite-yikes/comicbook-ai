import { useQuery } from "@tanstack/react-query";

export interface Veo3JobRecord {
  id: string;
  userId: string;
  projectId: string | null;
  prompt: string;
  model: string | null;
  status: string;
  resultAssetUri: string | null;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface JobListResponse {
  jobs: Veo3JobRecord[];
}

export function useVeo3Jobs(limit: number = 10, projectId?: string) {
  return useQuery<JobListResponse>({
    queryKey: ["veo3", "jobs", limit, projectId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (projectId) {
        params.append('projectId', projectId);
      }
      const response = await fetch(`/api/animations/jobs?${params.toString()}`, { credentials: "include" });
      if (response.status === 404) {
        return { jobs: [] };
      }
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to load Veo3 animation jobs");
      }
      const payload = (await response.json()) as JobListResponse;
      return {
        jobs: payload.jobs.map(job => ({
          ...job,
          createdAt: typeof job.createdAt === "string" ? job.createdAt : new Date(job.createdAt).toISOString(),
          updatedAt: typeof job.updatedAt === "string" ? job.updatedAt : new Date(job.updatedAt).toISOString(),
        })),
      };
    },
    refetchInterval: 5000,
  });
}
