interface VeoCredentials {
  apiKey: string;
  projectId?: string | null;
  location?: string | null;
}

export function getVeoCredentials(): VeoCredentials {
  const apiKey = process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || '';

  if (!apiKey) {
    throw new Error('VEO_API_KEY is not configured. Please add it to the secrets manager.');
  }

  return {
    apiKey,
    projectId: process.env.VEO_PROJECT_ID ?? null,
    location: process.env.VEO_LOCATION ?? null,
  };
}
