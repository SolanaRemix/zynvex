export const AGENT_PIPELINE = [
  "REQUEST",
  "AUTHORIZATION",
  "CONTEXT",
  "MEMORY",
  "KNOWLEDGE",
  "PLANNING",
  "TOOL_SELECTION",
  "TOOL_EXECUTION",
  "OBSERVATION",
  "NEXT_STEP",
  "FINAL_RESPONSE",
  "PERSISTENCE"
] as const;

export const EXECUTION_STATES = [
  "QUEUED",
  "STARTING",
  "PLANNING",
  "RUNNING",
  "WAITING_FOR_TOOL",
  "WAITING_FOR_APPROVAL",
  "PAUSED",
  "RETRYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMEOUT",
  "BUDGET_EXCEEDED"
] as const;

export const PLAN_STEP_STATUSES = ["PENDING", "READY", "RUNNING", "WAITING", "COMPLETED", "FAILED", "SKIPPED"] as const;
export const SWARM_ROLES = ["ORCHESTRATOR", "RESEARCHER", "ANALYST", "CODER", "DATA_AGENT", "SECURITY_AGENT", "QA_AGENT", "REVIEWER"] as const;
export const MEMORY_POLICIES = ["NEVER_SAVE", "ASK_FIRST", "AUTO_SAVE_LOW_RISK"] as const;
export const EXECUTION_TIMELINE_EVENTS = [
  "agent.started",
  "agent.planning",
  "agent.running",
  "tool.waiting",
  "approval.required",
  "agent.retrying",
  "agent.completed",
  "agent.failed"
] as const;

export type AgentExecutionStage = (typeof AGENT_PIPELINE)[number];
export type ExecutionState = (typeof EXECUTION_STATES)[number];
export type PlanStepStatus = (typeof PLAN_STEP_STATUSES)[number];
export type SwarmRole = (typeof SWARM_ROLES)[number];
export type MemoryPolicy = (typeof MEMORY_POLICIES)[number];
export type ExecutionTimelineEventType = (typeof EXECUTION_TIMELINE_EVENTS)[number];

export interface ExecutionBudget {
  maxTokens?: number;
  maxCost?: number;
  maxRuntimeMs?: number;
  maxToolCalls?: number;
}

export interface PlannerInput {
  objective: string;
  preferredAgent?: SwarmRole;
  tools?: string[];
  maxIterations?: number;
  budget?: ExecutionBudget;
}

export interface PlanStepDefinition {
  id: string;
  description: string;
  dependencies: string[];
  agent: SwarmRole;
  tools: string[];
  status: PlanStepStatus;
  budget?: ExecutionBudget;
  timeoutMs: number;
}

export interface ExecutionPlan {
  goal: string;
  steps: PlanStepDefinition[];
}

export interface TimelineEvent {
  type: ExecutionTimelineEventType;
  status: ExecutionState;
  summary: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

function toStepId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function detectGoalKeywords(objective: string) {
  const text = objective.toLowerCase();
  return {
    research: /research|investigate|analyz|compare|study/.test(text),
    documents: /document|pdf|file|report|knowledge/.test(text),
    code: /code|implement|fix|refactor|test|build/.test(text),
    data: /data|csv|sql|metric|analytics/.test(text),
    security: /security|vuln|audit|secret|permission/.test(text)
  };
}

export function createExecutionPlan(input: PlannerInput): ExecutionPlan {
  const goal = input.objective.trim();
  const keywords = detectGoalKeywords(goal);
  const steps: PlanStepDefinition[] = [];
  const tools = input.tools ?? [];
  const preferredAgent = input.preferredAgent ?? "ORCHESTRATOR";

  const addStep = (
    description: string,
    agent: SwarmRole,
    dependencies: string[] = [],
    extraTools: string[] = [],
    timeoutMs = DEFAULT_TIMEOUT_MS
  ) => {
    const id = toStepId(description) || `step-${steps.length + 1}`;
    steps.push({
      id,
      description,
      dependencies,
      agent,
      tools: [...new Set([...tools, ...extraTools])],
      status: dependencies.length === 0 ? "READY" : "PENDING",
      budget: input.budget,
      timeoutMs
    });
    return id;
  };

  const intake = addStep("Validate objective, scope, and execution limits", preferredAgent, [], [], 20_000);

  const discovery = addStep(
    keywords.documents ? "Inspect uploaded documents and extract relevant structure" : "Gather the required execution context",
    keywords.documents ? "RESEARCHER" : preferredAgent,
    [intake],
    keywords.documents ? ["documents.read"] : []
  );

  const research = keywords.research || keywords.security || keywords.data
    ? addStep(
        keywords.security
          ? "Perform scoped security and policy analysis"
          : keywords.data
            ? "Collect supporting data and evidence"
            : "Collect supporting research and references",
        keywords.security ? "SECURITY_AGENT" : keywords.data ? "DATA_AGENT" : "RESEARCHER",
        [discovery],
        keywords.security ? ["security.scan"] : keywords.data ? ["data.query"] : ["knowledge.search", "web.search"]
      )
    : undefined;

  const implementation = addStep(
    keywords.code ? "Execute the primary code or content changes" : "Execute the primary task plan",
    keywords.code ? "CODER" : preferredAgent,
    research ? [discovery, research] : [discovery],
    keywords.code ? ["code.write", "code.read"] : []
  );

  const qa = addStep(
    "Validate outputs, check risks, and prepare the final response",
    "QA_AGENT",
    [implementation],
    keywords.code ? ["tests.run"] : []
  );

  addStep("Return the final result with safe summaries and evidence", "REVIEWER", [qa], [], 20_000);

  return { goal, steps };
}

export function mapStageToStatus(stage: AgentExecutionStage): ExecutionState {
  if (stage === "PLANNING") return "PLANNING";
  if (stage === "TOOL_SELECTION" || stage === "TOOL_EXECUTION") return "WAITING_FOR_TOOL";
  if (stage === "FINAL_RESPONSE" || stage === "PERSISTENCE") return "RUNNING";
  return "STARTING";
}

export function getSafeStatusSummary(status: ExecutionState) {
  switch (status) {
    case "QUEUED":
      return "Queued for worker pickup";
    case "STARTING":
      return "Initializing execution context";
    case "PLANNING":
      return "Preparing a structured execution plan";
    case "RUNNING":
      return "Executing approved work";
    case "WAITING_FOR_TOOL":
      return "Waiting for an approved tool action";
    case "WAITING_FOR_APPROVAL":
      return "Approval is required before continuing";
    case "PAUSED":
      return "Execution paused";
    case "RETRYING":
      return "Retrying after a transient failure";
    case "COMPLETED":
      return "Execution completed";
    case "FAILED":
      return "Execution failed";
    case "CANCELLED":
      return "Execution cancelled";
    case "TIMEOUT":
      return "Execution exceeded its time limit";
    case "BUDGET_EXCEEDED":
      return "Execution stopped because its budget was exceeded";
  }
}

export function buildTimelineEvent(status: ExecutionState): TimelineEvent {
  const type: ExecutionTimelineEventType =
    status === "PLANNING"
      ? "agent.planning"
      : status === "WAITING_FOR_TOOL"
        ? "tool.waiting"
        : status === "WAITING_FOR_APPROVAL"
          ? "approval.required"
          : status === "RETRYING"
            ? "agent.retrying"
            : status === "COMPLETED"
              ? "agent.completed"
              : status === "FAILED" || status === "TIMEOUT" || status === "BUDGET_EXCEEDED"
                ? "agent.failed"
                : status === "STARTING" || status === "QUEUED"
                  ? "agent.started"
                  : "agent.running";

  return { type, status, summary: getSafeStatusSummary(status) };
}

export function nextRetryDelayMs(attempt: number) {
  if (attempt <= 1) return 1_000;
  if (attempt === 2) return 3_000;
  if (attempt === 3) return 10_000;
  return Math.min(30_000, 10_000 * Math.max(1, attempt - 2));
}

export function isBudgetExceeded(budget: ExecutionBudget | null | undefined, usage: { cost?: number; toolCalls?: number; runtimeMs?: number; tokens?: number }) {
  if (!budget) return false;
  if (budget.maxCost !== undefined && (usage.cost ?? 0) > budget.maxCost) return true;
  if (budget.maxToolCalls !== undefined && (usage.toolCalls ?? 0) > budget.maxToolCalls) return true;
  if (budget.maxRuntimeMs !== undefined && (usage.runtimeMs ?? 0) > budget.maxRuntimeMs) return true;
  if (budget.maxTokens !== undefined && (usage.tokens ?? 0) > budget.maxTokens) return true;
  return false;
}
