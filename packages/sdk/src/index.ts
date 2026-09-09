export interface ZynvexSdkConfig {
  baseUrl: string;
  apiKey: string;
}

export interface AgentExecuteInput {
  input: string;
  priority?: number;
  idempotencyKey?: string;
  timeoutSeconds?: number;
  maxIterations?: number;
  budget?: {
    maxTokens?: number;
    maxCost?: number;
    maxRuntimeMs?: number;
    maxToolCalls?: number;
  };
}

export interface WorkflowExecuteInput {
  input?: Record<string, unknown>;
  priority?: number;
  idempotencyKey?: string;
  timeoutSeconds?: number;
  budget?: AgentExecuteInput["budget"];
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

  agents = {
    list: () => this.request<{ agents: unknown[] }>("/api/v1/agents"),
    create: (body: Record<string, unknown>) => this.request<{ agent: unknown }>("/api/v1/agents", { method: "POST", body: JSON.stringify(body) }),
    execute: (agentId: string, body: AgentExecuteInput) =>
      this.request<{ execution: unknown }>(`/api/v1/agents/${agentId}/execute`, { method: "POST", body: JSON.stringify(body) }),
    getExecution: (executionId: string) => this.request<{ execution: unknown; steps: unknown[]; timeline: unknown[] }>(`/api/v1/executions/${executionId}`)
  };

  workflows = {
    list: () => this.request<{ workflows: unknown[] }>("/api/v1/workflows"),
    create: (body: Record<string, unknown>) => this.request<{ workflow: unknown }>("/api/v1/workflows", { method: "POST", body: JSON.stringify(body) }),
    execute: (workflowId: string, body: WorkflowExecuteInput = {}) =>
      this.request<{ execution: unknown }>(`/api/v1/workflows/${workflowId}/execute`, { method: "POST", body: JSON.stringify(body) })
  };

  knowledge = {
    search: (body: { query: string; limit?: number; projectId?: string }) =>
      this.request<{ results: unknown[] }>("/api/v1/knowledge/search", { method: "POST", body: JSON.stringify(body) })
  };

  projects = {
    create: (body: { name: string; description?: string }) =>
      this.request<{ project: unknown }>("/api/v1/projects", { method: "POST", body: JSON.stringify(body) })
  };
}
