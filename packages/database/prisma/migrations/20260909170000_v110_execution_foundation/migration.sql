-- ZYNVEX Enterprise V1.1.0 foundation migration
-- Expand-only migration for execution runtime, approvals, memory governance,
-- queue/worker orchestration, scheduling, prompts, evaluations, and observability.

ALTER TABLE "Memory"
  ADD COLUMN IF NOT EXISTS "agentId" TEXT,
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'FACT',
  ADD COLUMN IF NOT EXISTS "policy" TEXT NOT NULL DEFAULT 'ASK_FIRST',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE "AgentVersion"
  ADD COLUMN IF NOT EXISTS "versionTag" TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS "changelog" TEXT,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

ALTER TABLE "AgentExecution"
  ADD COLUMN IF NOT EXISTS "agentVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "budget" JSONB,
  ADD COLUMN IF NOT EXISTS "timeoutSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxIterations" INTEGER,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "triggerId" TEXT,
  ADD COLUMN IF NOT EXISTS "queueJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "currentPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT,
  ADD COLUMN IF NOT EXISTS "error" JSONB,
  ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "AgentExecutionStep"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WorkflowExecution"
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "budget" JSONB,
  ADD COLUMN IF NOT EXISTS "timeoutSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "triggerId" TEXT,
  ADD COLUMN IF NOT EXISTS "queueJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "input" JSONB,
  ADD COLUMN IF NOT EXISTS "output" JSONB;

ALTER TABLE "Webhook"
  ADD COLUMN IF NOT EXISTS "secretCipher" TEXT;

CREATE TABLE IF NOT EXISTS "AgentExecutionTransition" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentExecutionTransition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentPlanStep" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "dependencies" JSONB NOT NULL,
  "agentRole" TEXT NOT NULL,
  "tools" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "budget" JSONB,
  "timeoutSeconds" INTEGER,
  "orderIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentPlanStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QueueJob" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "executionId" TEXT,
  "workflowExecutionId" TEXT,
  "requestedById" TEXT,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "target" TEXT,
  "inputs" JSONB NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "policy" TEXT NOT NULL DEFAULT 'THRESHOLD',
  "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ApprovalDecision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "approvalRequestId" TEXT NOT NULL,
  "approverId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ToolPolicy" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "toolId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "maxCalls" INTEGER,
  "allowedDomains" JSONB,
  "allowedActions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ToolPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentSchedule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "schedule" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "input" JSONB,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentWebhookTrigger" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "secretCipher" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "allowedEvents" JSONB,
  "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 30,
  "lastTriggeredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentWebhookTrigger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IdempotencyKey" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "requestHash" TEXT,
  "response" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProviderHealthCheck" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "latencyMs" INTEGER,
  "errorRate" DOUBLE PRECISION,
  "availability" DOUBLE PRECISION,
  "rateLimited" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderHealthCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Prompt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "variables" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Evaluation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "agentId" TEXT,
  "workflowId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "cases" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvaluationRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "summary" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EvaluationResult" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "evaluationRunId" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "input" JSONB,
  "output" JSONB,
  "metrics" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentVersion_agentId_versionTag_key" ON "AgentVersion"("agentId", "versionTag");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentExecution_organizationId_idempotencyKey_key" ON "AgentExecution"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentPlan_executionId_key" ON "AgentPlan"("executionId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentPlanStep_planId_key_key" ON "AgentPlanStep"("planId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "QueueJob_organizationId_dedupeKey_key" ON "QueueJob"("organizationId", "dedupeKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ToolPolicy_organizationId_toolId_role_key" ON "ToolPolicy"("organizationId", "toolId", "role");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentWebhookTrigger_publicId_key" ON "AgentWebhookTrigger"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyKey_organizationId_scope_key_key" ON "IdempotencyKey"("organizationId", "scope", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "Prompt_organizationId_name_version_key" ON "Prompt"("organizationId", "name", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationResult_evaluationRunId_caseKey_key" ON "EvaluationResult"("evaluationRunId", "caseKey");

CREATE INDEX IF NOT EXISTS "Memory_agentId_idx" ON "Memory"("agentId");
CREATE INDEX IF NOT EXISTS "Memory_type_idx" ON "Memory"("type");
CREATE INDEX IF NOT EXISTS "Memory_expiresAt_idx" ON "Memory"("expiresAt");
CREATE INDEX IF NOT EXISTS "AgentExecution_agentVersionId_idx" ON "AgentExecution"("agentVersionId");
CREATE INDEX IF NOT EXISTS "AgentExecution_queueJobId_idx" ON "AgentExecution"("queueJobId");
CREATE INDEX IF NOT EXISTS "AgentExecution_status_idx" ON "AgentExecution"("status");
CREATE INDEX IF NOT EXISTS "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");
CREATE INDEX IF NOT EXISTS "AgentExecutionTransition_executionId_idx" ON "AgentExecutionTransition"("executionId");
CREATE INDEX IF NOT EXISTS "AgentExecutionTransition_createdAt_idx" ON "AgentExecutionTransition"("createdAt");
CREATE INDEX IF NOT EXISTS "AgentPlanStep_planId_idx" ON "AgentPlanStep"("planId");
CREATE INDEX IF NOT EXISTS "AgentPlanStep_status_idx" ON "AgentPlanStep"("status");
CREATE INDEX IF NOT EXISTS "QueueJob_kind_idx" ON "QueueJob"("kind");
CREATE INDEX IF NOT EXISTS "QueueJob_status_availableAt_priority_idx" ON "QueueJob"("status", "availableAt", "priority");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");
CREATE INDEX IF NOT EXISTS "ApprovalRequest_executionId_idx" ON "ApprovalRequest"("executionId");
CREATE INDEX IF NOT EXISTS "ApprovalDecision_approvalRequestId_idx" ON "ApprovalDecision"("approvalRequestId");
CREATE INDEX IF NOT EXISTS "AgentSchedule_enabled_nextRunAt_idx" ON "AgentSchedule"("enabled", "nextRunAt");
CREATE INDEX IF NOT EXISTS "ProviderHealthCheck_provider_idx" ON "ProviderHealthCheck"("provider");
CREATE INDEX IF NOT EXISTS "ProviderHealthCheck_checkedAt_idx" ON "ProviderHealthCheck"("checkedAt");
CREATE INDEX IF NOT EXISTS "Prompt_status_idx" ON "Prompt"("status");
CREATE INDEX IF NOT EXISTS "EvaluationRun_status_idx" ON "EvaluationRun"("status");
