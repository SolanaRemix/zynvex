export interface ZynvexSdkConfig {
  baseUrl: string;
  apiKey: string;
}

export class ZynvexSdk {
  constructor(private readonly config: ZynvexSdkConfig) {}

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + this.config.apiKey,
        ...(init?.headers || {})
      }
    });

    if (!response.ok) {
      throw new Error(`SDK request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  }
}
