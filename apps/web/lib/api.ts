export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

export function getApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_API_KEY;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new ApiError(
      "Missing API key. Set NEXT_PUBLIC_API_KEY in .env.local",
      500,
      "Configuration error: NEXT_PUBLIC_API_KEY is required",
    );
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(`API request failed: ${res.status} ${res.statusText}`, res.status, text);
  }

  return res.json();
}
