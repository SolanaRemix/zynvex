import { Prisma, prisma } from "@zynvex/database";
import {
  AGENT_PIPELINE,
  buildTimelineEvent,
  createExecutionPlan,
  getSafeStatusSummary,
  isBudgetExceeded,
  mapStageToStatus,
  nextRetryDelayMs,
  type ExecutionBudget,
  type ExecutionState
} from "@zynvex/agents";
import { ModelRouter, type AiProvider } from "@zynvex/ai";
import { computeWorkflowBatches, getRunnableNodeIds, validateWorkflowDefinition, type WorkflowEdge, type WorkflowNodeDefinition } from "@zynvex/workflows";
import { canAutoSaveMemory } from "@zynvex/memory";
import { ApiError } from "./errors";
import { decryptSecret, encryptSecret, sha256, signPayload } from "./crypto";
import { writeAuditLog } from "./audit";

const modelRouter = new ModelRouter(process.env);
const DEFAULT_AGENT_FALLBACKS: AiProvider[] = ["openai", "anthropic", "gemini", "deepseek", "ollama"];
const RETRYABLE_ERROR_PATTERNS = [/timeout/i, /network/i, /temporar/i, /rate limit/i, /fetch failed/i, /offline/i];

type QueueJobKind = "AGENT_EXECUTION" | "WORKFLOW_EXECUTION";

export interface QueueJobPayload {
  executionId: string;
  kind: QueueJobKind;
}

export interface EnqueueAgentExecutionInput {
  organizationId: string;
  userId: string;
  projectId?: string | null;
  agentId: string;
  input: string;
  priority?: number;
  budget?: ExecutionBudget;
  timeoutSeconds?: number;
  maxIterations?: number;
  idempotencyKey?: string;
  triggerType?: string;
  triggerId?: string;
}

export interface EnqueueWorkflowExecutionInput {
  organizationId: string;
  userId: string;
  workflowId: string;
  projectId?: string | null;
  input?: Record<string, unknown>;
  priority?: number;
  budget?: ExecutionBudget;
  timeoutSeconds?: number;
  idempotencyKey?: string;
  triggerType?: string;
  triggerId?: string;
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function createQueueJob(data: {
  organizationId: string;
  kind: QueueJobKind;
  dedupeKey?: string;
  priority?: number;
  payload: QueueJobPayload;
  maxAttempts?: number;
  availableAt?: Date;
}) {
  return prisma.queueJob.create({
    data: {
      organizationId: data.organizationId,
      kind: data.kind,
      dedupeKey: data.dedupeKey,
      priority: data.priority ?? 0,
      payload: toJsonValue(data.payload),
      maxAttempts: data.maxAttempts ?? 3,
      availableAt: data.availableAt ?? new Date()
    }
  });
}

async function claimIdempotencyKey(input: {
  organizationId: string;
  scope: string;
  key?: string;
  resourceType: string;
  request: unknown;
}) {
  if (!input.key) return null;

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      organizationId_scope_key: {
        organizationId: input.organizationId,
        scope: input.scope,
        key: input.key
      }
    }
  });

  const requestHash = sha256(JSON.stringify(input.request));
  if (existing) {
    if (existing.requestHash && existing.requestHash !== requestHash) {
      throw new ApiError("CONFLICT", 409, "Idempotency key was already used with a different request");
    }

    return existing;
  }

  return prisma.idempotencyKey.create({
    data: {
      organizationId: input.organizationId,
      scope: input.scope,
      key: input.key,
      resourceType: input.resourceType,
      requestHash
    }
  });
}

export async function recordExecutionTransition(input: {
  organizationId: string;
  executionId: string;
  status: ExecutionState;
  summary?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const timeline = buildTimelineEvent(input.status);
  return prisma.agentExecutionTransition.create({
    data: {
      organizationId: input.organizationId,
      executionId: input.executionId,
      status: input.status,
      summary: input.summary ?? timeline.summary,
      metadata: input.metadata
    }
  });
}

async function ensureExecutionSteps(executionId: string, organizationId: string, input: string) {
  const count = await prisma.agentExecutionStep.count({ where: { executionId, organizationId } });
  if (count > 0) return;

  for (const [stepIndex, stage] of AGENT_PIPELINE.entries()) {
    await prisma.agentExecutionStep.create({
      data: {
        organizationId,
        executionId,
        stepIndex,
        stage,
        status: stepIndex === 0 ? "COMPLETED" : "PENDING",
        payload: stage === "REQUEST" ? toJsonValue({ input }) : undefined
      }
    });
  }
}

async function updatePipelineStage(executionId: string, organizationId: string, stage: string, status: string, payload?: Prisma.InputJsonValue) {
  await prisma.agentExecutionStep.updateMany({
    where: { executionId, organizationId, stage },
    data: { status, payload, updatedAt: new Date() }
  });
}

async function createTaskRecord(input: { organizationId: string; projectId?: string | null; sourceType: string; sourceId: string; status: string }) {
  return prisma.task.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: input.status
    }
  });
}

async function createTaskEvent(input: { organizationId: string; taskId: string; level: string; message: string; metadata?: Prisma.InputJsonValue }) {
  return prisma.taskEvent.create({
    data: {
      organizationId: input.organizationId,
      taskId: input.taskId,
      level: input.level,
      message: input.message,
      metadata: input.metadata
    }
  });
}

export async function enqueueAgentExecution(input: EnqueueAgentExecutionInput) {
  const agent = await prisma.agent.findFirst({
    where: { id: input.agentId, organizationId: input.organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" }
  });

  if (!agent) throw new ApiError("NOT_FOUND", 404, "Agent not found");

  const version = await prisma.agentVersion.findFirst({
    where: { agentId: agent.id, organizationId: input.organizationId },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }]
  });

  const requestPayload = {
    agentId: input.agentId,
    input: input.input,
    priority: input.priority ?? 0,
    budget: input.budget ?? null,
    timeoutSeconds: input.timeoutSeconds ?? agent.timeoutSeconds,
    maxIterations: input.maxIterations ?? agent.maxIterations
  };

  const idempotency = await claimIdempotencyKey({
    organizationId: input.organizationId,
    scope: "agent.execute",
    key: input.idempotencyKey,
    resourceType: "AGENT_EXECUTION",
    request: requestPayload
  });

  if (idempotency?.resourceId) {
    const existing = await prisma.agentExecution.findFirst({
      where: { id: idempotency.resourceId, organizationId: input.organizationId }
    });
    if (existing) return existing;
  }

  const job = await createQueueJob({
    organizationId: input.organizationId,
    kind: "AGENT_EXECUTION",
    dedupeKey: input.idempotencyKey ? `agent:${input.agentId}:${input.idempotencyKey}` : undefined,
    priority: input.priority,
    payload: { executionId: "", kind: "AGENT_EXECUTION" }
  });

  const execution = await prisma.agentExecution.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId ?? agent.projectId,
      agentId: agent.id,
      agentVersionId: version?.id,
      startedById: input.userId,
      status: "QUEUED",
      priority: input.priority ?? 0,
      budget: input.budget ? toJsonValue(input.budget) : undefined,
      timeoutSeconds: input.timeoutSeconds ?? agent.timeoutSeconds,
      maxIterations: input.maxIterations ?? agent.maxIterations,
      idempotencyKey: input.idempotencyKey,
      triggerType: input.triggerType ?? "MANUAL",
      triggerId: input.triggerId,
      queueJobId: job.id,
      input: toJsonValue({ text: input.input }),
      summary: getSafeStatusSummary("QUEUED")
    }
  });

  await prisma.queueJob.update({
    where: { id: job.id },
    data: { payload: toJsonValue({ executionId: execution.id, kind: "AGENT_EXECUTION" }) }
  });

  if (idempotency) {
    await prisma.idempotencyKey.update({
      where: { id: idempotency.id },
      data: { resourceId: execution.id, status: "COMPLETED" }
    });
  }

  const task = await createTaskRecord({
    organizationId: input.organizationId,
    projectId: input.projectId ?? agent.projectId,
    sourceType: "AGENT_EXECUTION",
    sourceId: execution.id,
    status: "QUEUED"
  });

  await createTaskEvent({
    organizationId: input.organizationId,
    taskId: task.id,
    level: "info",
    message: "Execution queued",
    metadata: toJsonValue({ executionId: execution.id })
  });

  await ensureExecutionSteps(execution.id, input.organizationId, input.input);
  await recordExecutionTransition({ organizationId: input.organizationId, executionId: execution.id, status: "QUEUED" });

  return execution;
}

export async function enqueueWorkflowExecution(input: EnqueueWorkflowExecutionInput) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: input.workflowId, organizationId: input.organizationId }
  });

  if (!workflow) throw new ApiError("NOT_FOUND", 404, "Workflow not found");

  const requestPayload = {
    workflowId: workflow.id,
    input: input.input ?? {},
    priority: input.priority ?? 0,
    timeoutSeconds: input.timeoutSeconds
  };

  const idempotency = await claimIdempotencyKey({
    organizationId: input.organizationId,
    scope: "workflow.execute",
    key: input.idempotencyKey,
    resourceType: "WORKFLOW_EXECUTION",
    request: requestPayload
  });

  if (idempotency?.resourceId) {
    const existing = await prisma.workflowExecution.findFirst({
      where: { id: idempotency.resourceId, organizationId: input.organizationId }
    });
    if (existing) return existing;
  }

  const job = await createQueueJob({
    organizationId: input.organizationId,
    kind: "WORKFLOW_EXECUTION",
    dedupeKey: input.idempotencyKey ? `workflow:${workflow.id}:${input.idempotencyKey}` : undefined,
    priority: input.priority,
    payload: { executionId: "", kind: "WORKFLOW_EXECUTION" }
  });

  const execution = await prisma.workflowExecution.create({
    data: {
      organizationId: input.organizationId,
      workflowId: workflow.id,
      startedById: input.userId,
      status: "QUEUED",
      priority: input.priority ?? 0,
      budget: input.budget ? toJsonValue(input.budget) : undefined,
      timeoutSeconds: input.timeoutSeconds,
      idempotencyKey: input.idempotencyKey,
      triggerType: input.triggerType ?? "MANUAL",
      triggerId: input.triggerId,
      queueJobId: job.id,
      input: toJsonValue(input.input ?? {})
    }
  });

  await prisma.queueJob.update({
    where: { id: job.id },
    data: { payload: toJsonValue({ executionId: execution.id, kind: "WORKFLOW_EXECUTION" }) }
  });

  if (idempotency) {
    await prisma.idempotencyKey.update({
      where: { id: idempotency.id },
      data: { resourceId: execution.id, status: "COMPLETED" }
    });
  }

  await createTaskRecord({
    organizationId: input.organizationId,
    projectId: input.projectId ?? workflow.projectId,
    sourceType: "WORKFLOW_EXECUTION",
    sourceId: execution.id,
    status: "QUEUED"
  });

  return execution;
}

export async function claimNextQueueJob(workerId: string) {
  const next = await prisma.queueJob.findFirst({
    where: {
      status: "QUEUED",
      availableAt: { lte: new Date() }
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });

  if (!next) return null;

  const claimed = await prisma.queueJob.updateMany({
    where: { id: next.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      lockedAt: new Date(),
      lockedBy: workerId,
      attempts: { increment: 1 }
    }
  });

  if (!claimed.count) return null;
  return prisma.queueJob.findUnique({ where: { id: next.id } });
}

async function markTaskStatus(executionId: string, sourceType: string, organizationId: string, status: string, cost?: number) {
  await prisma.task.updateMany({
    where: { organizationId, sourceId: executionId, sourceType },
    data: {
      status,
      startedAt: status === "RUNNING" ? new Date() : undefined,
      completedAt: ["COMPLETED", "FAILED", "CANCELLED", "TIMEOUT", "BUDGET_EXCEEDED"].includes(status) ? new Date() : undefined,
      cost
    }
  });
}

async function maybeCreateApprovalRequest(input: {
  organizationId: string;
  executionId: string;
  projectId?: string | null;
  requestedById: string;
  action: string;
  reason: string;
  target?: string;
  inputs: Record<string, unknown>;
  policy: string;
}) {
  if (input.policy === "auto") return null;

  const existing = await prisma.approvalRequest.findFirst({
    where: { organizationId: input.organizationId, executionId: input.executionId, status: "PENDING" }
  });
  if (existing) return existing;

  return prisma.approvalRequest.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      executionId: input.executionId,
      requestedById: input.requestedById,
      action: input.action,
      reason: input.reason,
      target: input.target,
      inputs: toJsonValue(input.inputs),
      riskLevel: input.policy === "two_person" ? "HIGH" : "MEDIUM",
      status: "PENDING",
      policy: input.policy === "two_person" ? "TWO_PERSON" : "MANUAL",
      requiredApprovals: input.policy === "two_person" ? 2 : 1,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60)
    }
  });
}

async function saveAutoMemory(input: {
  organizationId: string;
  projectId?: string | null;
  ownerId: string;
  agentId?: string | null;
  source: string;
  content: string;
}) {
  const memory = {
    scope: "user",
    ownerId: input.ownerId,
    type: "TASK" as const,
    policy: "AUTO_SAVE_LOW_RISK" as const,
    source: input.source,
    confidence: 0.65,
    content: input.content
  };

  if (!canAutoSaveMemory(memory)) return;

  await prisma.memory.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      ownerId: input.ownerId,
      agentId: input.agentId,
      scope: memory.scope,
      type: memory.type,
      policy: memory.policy,
      source: memory.source,
      confidence: memory.confidence,
      content: memory.content
    }
  });
}

async function collectContext(organizationId: string, ownerId: string, prompt: string) {
  const [memories, chunks] = await Promise.all([
    prisma.memory.findMany({
      where: {
        organizationId,
        ownerId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: [{ updatedAt: "desc" }, { confidence: "desc" }],
      take: 5
    }),
    prisma.documentChunk.findMany({
      where: {
        organizationId,
        content: { contains: prompt.slice(0, 64), mode: "insensitive" }
      },
      take: 3
    })
  ]);

  return { memories, chunks };
}

function buildPrompt(input: {
  objective: string;
  systemPrompt: string;
  plan: ReturnType<typeof createExecutionPlan>;
  memories: Array<{ content: string }>;
  chunks: Array<{ documentId: string; content: string; metadata: Prisma.JsonValue | null }>;
}) {
  const memorySection = input.memories.length
    ? input.memories.map((memory, index) => `${index + 1}. ${memory.content}`).join("\n")
    : "No durable memory available.";
  const knowledgeSection = input.chunks.length
    ? input.chunks.map((chunk, index) => `${index + 1}. [document:${chunk.documentId}] ${chunk.content}`).join("\n")
    : "No matching knowledge retrieved.";
  const planSection = input.plan.steps.map((step) => `- ${step.description}`).join("\n");

  return `${input.systemPrompt}

Objective:
${input.objective}

Execution plan:
${planSection}

Memory context:
${memorySection}

Knowledge context:
${knowledgeSection}

Return a concise execution result. Include source identifiers only when evidence is present. Do not reveal hidden reasoning.`;
}

async function processAgentExecution(executionId: string, workerId: string) {
  const execution = await prisma.agentExecution.findUnique({ where: { id: executionId } });
  if (!execution) return;

  const agent = await prisma.agent.findUnique({ where: { id: execution.agentId } });
  if (!agent) throw new Error("Agent not found during execution");

  await ensureExecutionSteps(execution.id, execution.organizationId, String((execution.input as { text?: string })?.text ?? ""));
  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: { status: "STARTING", summary: getSafeStatusSummary("STARTING"), startedAt: new Date() }
  });
  await markTaskStatus(execution.id, "AGENT_EXECUTION", execution.organizationId, "RUNNING");
  await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status: "STARTING", metadata: toJsonValue({ workerId }) });

  const approval = await maybeCreateApprovalRequest({
    organizationId: execution.organizationId,
    executionId: execution.id,
    projectId: execution.projectId,
    requestedById: execution.startedById,
    action: "agent.execute",
    reason: "Agent policy requires human approval before execution",
    target: agent.name,
    inputs: { input: execution.input },
    policy: agent.approvalPolicy
  });

  if (approval) {
    await prisma.agentExecution.update({
      where: { id: execution.id },
      data: { status: "WAITING_FOR_APPROVAL", summary: getSafeStatusSummary("WAITING_FOR_APPROVAL") }
    });
    await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status: "WAITING_FOR_APPROVAL" });
    await updatePipelineStage(execution.id, execution.organizationId, "AUTHORIZATION", "WAITING", toJsonValue({ approvalRequestId: approval.id }));
    return;
  }

  await updatePipelineStage(execution.id, execution.organizationId, "AUTHORIZATION", "COMPLETED");
  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: { status: "PLANNING", summary: getSafeStatusSummary("PLANNING") }
  });
  await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status: "PLANNING" });
  await updatePipelineStage(execution.id, execution.organizationId, "PLANNING", "RUNNING");

  const objective = String((execution.input as { text?: string })?.text ?? "");
  const plan = createExecutionPlan({
    objective,
    budget: (execution.budget as ExecutionBudget | undefined) ?? undefined,
    maxIterations: execution.maxIterations ?? agent.maxIterations
  });

  const persistedPlan = await prisma.agentPlan.upsert({
    where: { executionId: execution.id },
    create: {
      organizationId: execution.organizationId,
      executionId: execution.id,
      goal: plan.goal,
      status: "RUNNING"
    },
    update: {
      goal: plan.goal,
      status: "RUNNING"
    }
  });

  await prisma.agentPlanStep.deleteMany({ where: { planId: persistedPlan.id } });
  await prisma.agentPlanStep.createMany({
    data: plan.steps.map((step, index) => ({
      organizationId: execution.organizationId,
      planId: persistedPlan.id,
      key: step.id,
      description: step.description,
      dependencies: toJsonValue(step.dependencies),
      agentRole: step.agent,
      tools: toJsonValue(step.tools),
      status: step.status,
      budget: step.budget ? toJsonValue(step.budget) : undefined,
      timeoutSeconds: Math.ceil(step.timeoutMs / 1000),
      orderIndex: index
    }))
  });

  await updatePipelineStage(execution.id, execution.organizationId, "PLANNING", "COMPLETED", toJsonValue({ planId: persistedPlan.id }));
  await updatePipelineStage(execution.id, execution.organizationId, "CONTEXT", "COMPLETED");

  const context = await collectContext(execution.organizationId, execution.startedById, objective);
  await updatePipelineStage(execution.id, execution.organizationId, "MEMORY", "COMPLETED", toJsonValue({ memoryCount: context.memories.length }));
  await updatePipelineStage(execution.id, execution.organizationId, "KNOWLEDGE", "COMPLETED", toJsonValue({ chunkCount: context.chunks.length }));

  for (const stage of ["TOOL_SELECTION", "TOOL_EXECUTION", "OBSERVATION", "NEXT_STEP"] as const) {
    const status = mapStageToStatus(stage);
    await prisma.agentExecution.update({
      where: { id: execution.id },
      data: { status, summary: getSafeStatusSummary(status) }
    });
    await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status });
    await updatePipelineStage(execution.id, execution.organizationId, stage, "COMPLETED");
  }

  const prompt = buildPrompt({
    objective,
    systemPrompt: agent.systemPrompt,
    plan,
    memories: context.memories,
    chunks: context.chunks
  });

  const startedAt = execution.startedAt?.getTime() ?? Date.now();
  const result = await modelRouter.run({
    prompt,
    model: agent.model,
    temperature: agent.temperature,
    maxTokens: execution.maxIterations ? execution.maxIterations * 256 : undefined,
    fallbackProviders: DEFAULT_AGENT_FALLBACKS
  });

  const runtimeMs = Date.now() - startedAt;
  const totalTokens = result.inputTokens + result.outputTokens;
  if (isBudgetExceeded(execution.budget as ExecutionBudget | null | undefined, { cost: result.estimatedCost, runtimeMs, tokens: totalTokens })) {
    await prisma.agentExecution.update({
      where: { id: execution.id },
      data: { status: "BUDGET_EXCEEDED", summary: getSafeStatusSummary("BUDGET_EXCEEDED"), completedAt: new Date(), cost: result.estimatedCost }
    });
    await markTaskStatus(execution.id, "AGENT_EXECUTION", execution.organizationId, "BUDGET_EXCEEDED", result.estimatedCost);
    await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status: "BUDGET_EXCEEDED" });
    return;
  }

  const citations = context.chunks.map((chunk) => ({
    documentId: chunk.documentId,
    excerpt: chunk.content.slice(0, 240),
    metadata: chunk.metadata
  }));

  await updatePipelineStage(execution.id, execution.organizationId, "FINAL_RESPONSE", "COMPLETED");
  await updatePipelineStage(execution.id, execution.organizationId, "PERSISTENCE", "COMPLETED");
  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: {
      status: "COMPLETED",
      summary: getSafeStatusSummary("COMPLETED"),
      output: toJsonValue({ text: result.output, citations }),
      completedAt: new Date(),
      cost: result.estimatedCost
    }
  });
  await prisma.agentPlan.update({ where: { id: persistedPlan.id }, data: { status: "COMPLETED" } });
  await prisma.agentPlanStep.updateMany({ where: { planId: persistedPlan.id }, data: { status: "COMPLETED" } });
  await prisma.usageRecord.create({
    data: {
      organizationId: execution.organizationId,
      projectId: execution.projectId,
      agentId: execution.agentId,
      executionId: execution.id,
      provider: result.provider,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCost: result.estimatedCost
    }
  });
  await markTaskStatus(execution.id, "AGENT_EXECUTION", execution.organizationId, "COMPLETED", result.estimatedCost);
  await recordExecutionTransition({
    organizationId: execution.organizationId,
    executionId: execution.id,
    status: "COMPLETED",
    metadata: toJsonValue({ provider: result.provider, attempts: result.attempts, citations: citations.length })
  });
  await saveAutoMemory({
    organizationId: execution.organizationId,
    projectId: execution.projectId,
    ownerId: execution.startedById,
    agentId: execution.agentId,
    source: `agent_execution:${execution.id}`,
    content: result.output.slice(0, 400)
  });
  await writeAuditLog({
    organizationId: execution.organizationId,
    actorId: execution.startedById,
    action: "agent.execute",
    resource: "AgentExecution",
    resourceId: execution.id,
    result: "COMPLETED",
    metadata: toJsonValue({ agentId: execution.agentId })
  });
}

async function processWorkflowExecution(executionId: string) {
  const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId } });
  if (!execution) return;

  const workflow = await prisma.workflow.findUnique({ where: { id: execution.workflowId } });
  if (!workflow) throw new Error("Workflow not found during execution");

  const version = await prisma.workflowVersion.findFirst({
    where: { workflowId: workflow.id, organizationId: execution.organizationId },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }]
  });

  const definition = (version?.definition as { nodes?: WorkflowNodeDefinition[]; edges?: WorkflowEdge[] } | null) ?? { nodes: [] };
  const nodes = definition.nodes ?? [];
  const edges = definition.edges;
  validateWorkflowDefinition(nodes, edges);
  const batches = computeWorkflowBatches(nodes, edges);
  const completed = new Set<string>();
  const outputs: Record<string, unknown> = {};

  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: { status: "RUNNING", startedAt: new Date(), output: toJsonValue({ batches }) }
  });
  await markTaskStatus(execution.id, "WORKFLOW_EXECUTION", execution.organizationId, "RUNNING");

  while (completed.size < nodes.length) {
    const runnable = getRunnableNodeIds(nodes, [...completed], [], edges);
    for (const nodeId of runnable) {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) continue;

      if (node.nodeType === "HUMAN_APPROVAL") {
        const approval = await prisma.approvalRequest.create({
          data: {
            organizationId: execution.organizationId,
            workflowExecutionId: execution.id,
            requestedById: execution.startedById,
            action: "workflow.node.approval",
            reason: `Workflow node "${node.name}" requires approval`,
            target: workflow.name,
            inputs: toJsonValue(node.config),
            riskLevel: "HIGH"
          }
        });

        await prisma.workflowExecution.update({
          where: { id: execution.id },
          data: { status: "WAITING_FOR_APPROVAL", output: toJsonValue({ ...outputs, waitingForApprovalId: approval.id, batches }) }
        });
        return;
      }

      if (node.nodeType === "AI" || node.nodeType === "AGENT") {
        const prompt = typeof node.config.prompt === "string" ? node.config.prompt : JSON.stringify(execution.input ?? {});
        const model = typeof node.config.model === "string" ? node.config.model : "gpt-4o-mini";
        const result = await modelRouter.run({ prompt, model, fallbackProviders: DEFAULT_AGENT_FALLBACKS });
        outputs[node.id] = { output: result.output, provider: result.provider, model: result.model };
      } else if (node.nodeType === "WEBHOOK") {
        outputs[node.id] = { dispatched: false, reason: "Use organization webhooks for outbound delivery." };
      } else {
        outputs[node.id] = { status: "completed", nodeType: node.nodeType };
      }

      completed.add(node.id);
    }
  }

  await prisma.workflowExecution.update({
    where: { id: execution.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      output: toJsonValue({
        batches,
        nodes: outputs
      })
    }
  });
  await markTaskStatus(execution.id, "WORKFLOW_EXECUTION", execution.organizationId, "COMPLETED");
}

async function handleExecutionError(jobId: string, payload: QueueJobPayload, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown execution error";
  const job = await prisma.queueJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.attempts < job.maxAttempts && isRetryableError(error)) {
    const delay = nextRetryDelayMs(job.attempts);
    await prisma.queueJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        lastError: message,
        availableAt: new Date(Date.now() + delay),
        lockedAt: null,
        lockedBy: null
      }
    });

    if (payload.kind === "AGENT_EXECUTION") {
      const execution = await prisma.agentExecution.findUnique({ where: { id: payload.executionId } });
      if (execution) {
        await prisma.agentExecution.update({
          where: { id: execution.id },
          data: { status: "RETRYING", summary: getSafeStatusSummary("RETRYING"), failureReason: message }
        });
        await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status: "RETRYING" });
      }
    }
    return;
  }

  await prisma.queueJob.update({
    where: { id: job.id },
    data: { status: "FAILED", lastError: message, completedAt: new Date() }
  });

  if (payload.kind === "AGENT_EXECUTION") {
    const execution = await prisma.agentExecution.findUnique({ where: { id: payload.executionId } });
    if (!execution) return;

    const timeoutHit = execution.timeoutSeconds ? Date.now() - execution.startedAt.getTime() > execution.timeoutSeconds * 1000 : false;
    const status: ExecutionState = timeoutHit ? "TIMEOUT" : "FAILED";
    await prisma.agentExecution.update({
      where: { id: execution.id },
      data: { status, summary: getSafeStatusSummary(status), failureReason: message, completedAt: new Date(), error: toJsonValue({ message }) }
    });
    await markTaskStatus(execution.id, "AGENT_EXECUTION", execution.organizationId, status);
    await recordExecutionTransition({ organizationId: execution.organizationId, executionId: execution.id, status, metadata: toJsonValue({ message }) });
    return;
  }

  const workflowExecution = await prisma.workflowExecution.findUnique({ where: { id: payload.executionId } });
  if (workflowExecution) {
    await prisma.workflowExecution.update({
      where: { id: workflowExecution.id },
      data: { status: "FAILED", failureReason: message, completedAt: new Date() }
    });
    await markTaskStatus(workflowExecution.id, "WORKFLOW_EXECUTION", workflowExecution.organizationId, "FAILED");
  }
}

export async function processQueueJob(workerId: string) {
  const job = await claimNextQueueJob(workerId);
  if (!job) return null;

  const payload = job.payload as unknown as QueueJobPayload;

  try {
    if (payload.kind === "AGENT_EXECUTION") {
      await processAgentExecution(payload.executionId, workerId);
    } else {
      await processWorkflowExecution(payload.executionId);
    }

    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() }
    });
  } catch (error) {
    await handleExecutionError(job.id, payload, error);
  }

  return job;
}

function getStepParts(expression: string) {
  if (/^\d+$/.test(expression)) return Number(expression);
  if (expression === "*") return 1;
  if (expression.startsWith("*/")) return Math.max(1, Number(expression.slice(2)));
  return null;
}

export function computeNextScheduleRun(schedule: string, now = new Date()) {
  const trimmed = schedule.trim();
  if (trimmed === "@hourly") return new Date(now.getTime() + 60 * 60 * 1000);
  if (trimmed === "@daily") return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (trimmed === "@weekly") return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return new Date(trimmed);

  const parts = trimmed.split(/\s+/);
  if (parts.length !== 5) throw new ApiError("BAD_REQUEST", 400, "Unsupported schedule expression");
  const [minuteExpr, hourExpr] = parts;
  const minuteStep = getStepParts(minuteExpr);
  const hourStep = getStepParts(hourExpr);
  if (minuteStep === null || hourStep === null) throw new ApiError("BAD_REQUEST", 400, "Unsupported cron expression");

  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + minuteStep);
  next.setHours(next.getHours() + (hourExpr === "*" ? 0 : hourStep));
  return next;
}

export async function runDueSchedules(workerId: string, limit = 10) {
  const schedules = await prisma.agentSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: new Date() } },
    orderBy: { nextRunAt: "asc" },
    take: limit
  });

  for (const schedule of schedules) {
    const execution = await enqueueAgentExecution({
      organizationId: schedule.organizationId,
      userId: "system",
      projectId: null,
      agentId: schedule.agentId,
      input: typeof (schedule.input as { input?: string } | null)?.input === "string" ? String((schedule.input as { input?: string }).input) : `Scheduled execution from ${schedule.schedule}`,
      triggerType: "SCHEDULE",
      triggerId: schedule.id
    });

    await prisma.agentSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: computeNextScheduleRun(schedule.schedule),
        updatedAt: new Date()
      }
    });

    await writeAuditLog({
      organizationId: schedule.organizationId,
      actorId: "system",
      action: "agent.schedule.run",
      resource: "AgentSchedule",
      resourceId: schedule.id,
      result: "ENQUEUED",
      metadata: toJsonValue({ executionId: execution.id, workerId })
    });
  }

  return schedules.length;
}

export async function getExecutionTimeline(organizationId: string, executionId: string) {
  return prisma.agentExecutionTransition.findMany({
    where: { organizationId, executionId },
    orderBy: { createdAt: "asc" }
  });
}

export async function createAgentSchedule(input: {
  organizationId: string;
  agentId: string;
  schedule: string;
  timezone: string;
  input?: Record<string, unknown>;
}) {
  const nextRunAt = computeNextScheduleRun(input.schedule);
  return prisma.agentSchedule.create({
    data: {
      organizationId: input.organizationId,
      agentId: input.agentId,
      schedule: input.schedule,
      timezone: input.timezone,
      input: input.input ? toJsonValue(input.input) : undefined,
      nextRunAt
    }
  });
}

export async function createAgentWebhookTrigger(input: {
  organizationId: string;
  agentId: string;
  allowedEvents?: string[];
  rateLimitPerMinute?: number;
}) {
  const secret = crypto.randomUUID().replace(/-/g, "");
  const trigger = await prisma.agentWebhookTrigger.create({
    data: {
      organizationId: input.organizationId,
      agentId: input.agentId,
      publicId: crypto.randomUUID(),
      secretHash: sha256(secret),
      secretCipher: encryptSecret(secret),
      allowedEvents: input.allowedEvents ? toJsonValue(input.allowedEvents) : undefined,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 30
    }
  });

  return { trigger, secret };
}

export async function verifyAgentWebhookSignature(input: {
  publicId: string;
  signature: string | null;
  timestamp: string | null;
  body: string;
}) {
  const trigger = await prisma.agentWebhookTrigger.findUnique({ where: { publicId: input.publicId } });
  if (!trigger || !trigger.enabled) throw new ApiError("NOT_FOUND", 404, "Webhook trigger not found");
  if (!input.signature || !input.timestamp) throw new ApiError("UNAUTHORIZED", 401, "Missing webhook signature");

  const timestampMs = Number(input.timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new ApiError("UNAUTHORIZED", 401, "Webhook timestamp is outside the allowed replay window");
  }

  const storedSecret = trigger.secretCipher ? decryptSecret(trigger.secretCipher) : null;
  if (!storedSecret) throw new ApiError("NOT_CONFIGURED", 500, "Webhook secret is not configured");

  const expected = signPayload(storedSecret, `${input.timestamp}.${input.body}`);
  if (expected !== input.signature) throw new ApiError("UNAUTHORIZED", 401, "Invalid webhook signature");

  const replayKey = `webhook:${trigger.publicId}:${input.signature}`;
  const replay = await prisma.idempotencyKey.findUnique({
    where: {
      organizationId_scope_key: {
        organizationId: trigger.organizationId,
        scope: "webhook.replay",
        key: replayKey
      }
    }
  });
  if (replay) throw new ApiError("CONFLICT", 409, "Webhook replay detected");

  await prisma.idempotencyKey.create({
    data: {
      organizationId: trigger.organizationId,
      scope: "webhook.replay",
      key: replayKey,
      status: "COMPLETED",
      resourceType: "AGENT_WEBHOOK_TRIGGER",
      resourceId: trigger.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  return trigger;
}

export async function dispatchWebhookEvent(input: {
  organizationId: string;
  event: string;
  payload: Record<string, unknown>;
}) {
  const hooks = await prisma.webhook.findMany({
    where: { organizationId: input.organizationId, enabled: true }
  });

  const body = JSON.stringify({ event: input.event, timestamp: new Date().toISOString(), payload: input.payload });

  await Promise.all(
    hooks
      .filter((hook) => {
        const events = Array.isArray(hook.events) ? hook.events.map(String) : [];
        return events.includes("*") || events.includes(input.event);
      })
      .map(async (hook) => {
        const secret = hook.secretCipher ? decryptSecret(hook.secretCipher) : null;
        const signature = secret ? signPayload(secret, body) : "";
        await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-zynvex-event": input.event,
            "x-zynvex-signature": signature
          },
          body
        }).catch(() => undefined);
      })
  );
}

export async function resolveApprovalRequest(input: {
  organizationId: string;
  approvalRequestId: string;
  approverId: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string;
}) {
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: input.approvalRequestId, organizationId: input.organizationId }
  });
  if (!approval) throw new ApiError("NOT_FOUND", 404, "Approval request not found");
  if (approval.status !== "PENDING") return approval;

  await prisma.approvalDecision.create({
    data: {
      organizationId: input.organizationId,
      approvalRequestId: approval.id,
      approverId: input.approverId,
      decision: input.decision,
      comment: input.comment
    }
  });

  if (input.decision === "REJECTED") {
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: "REJECTED", resolvedAt: new Date() }
    });

    if (approval.executionId) {
      await prisma.agentExecution.update({
        where: { id: approval.executionId },
        data: { status: "FAILED", summary: "Execution was rejected during approval.", failureReason: input.comment ?? "Rejected during approval", completedAt: new Date() }
      });
      await recordExecutionTransition({ organizationId: input.organizationId, executionId: approval.executionId, status: "FAILED", summary: "Execution rejected during approval" });
    }

    return prisma.approvalRequest.findUnique({ where: { id: approval.id } });
  }

  const approvals = await prisma.approvalDecision.count({
    where: { approvalRequestId: approval.id, organizationId: input.organizationId, decision: "APPROVED" }
  });

  if (approvals >= approval.requiredApprovals) {
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: "APPROVED", resolvedAt: new Date() }
    });

    if (approval.executionId) {
      await prisma.agentExecution.update({
        where: { id: approval.executionId },
        data: { status: "QUEUED", summary: getSafeStatusSummary("QUEUED") }
      });
      await recordExecutionTransition({ organizationId: input.organizationId, executionId: approval.executionId, status: "QUEUED", summary: "Execution re-queued after approval" });
      await createQueueJob({
        organizationId: input.organizationId,
        kind: "AGENT_EXECUTION",
        priority: 0,
        payload: { executionId: approval.executionId, kind: "AGENT_EXECUTION" }
      });
    }

    if (approval.workflowExecutionId) {
      await prisma.workflowExecution.update({
        where: { id: approval.workflowExecutionId },
        data: { status: "QUEUED" }
      });
      await createQueueJob({
        organizationId: input.organizationId,
        kind: "WORKFLOW_EXECUTION",
        priority: 0,
        payload: { executionId: approval.workflowExecutionId, kind: "WORKFLOW_EXECUTION" }
      });
    }
  }

  return prisma.approvalRequest.findUnique({ where: { id: approval.id } });
}
