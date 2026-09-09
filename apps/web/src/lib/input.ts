import type { Prisma } from "@zynvex/database";
import { z } from "zod";

type JsonInput = string | number | boolean | null | JsonInput[] | { [key: string]: JsonInput };

const jsonValueSchema: z.ZodType<JsonInput> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(z.string(), jsonValueSchema);

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1).max(120)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const projectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional()
});

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  systemInstruction: z.string().max(4000).optional()
});

export const agentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.2),
  maxIterations: z.number().int().min(1).max(50).default(10),
  timeoutSeconds: z.number().int().min(5).max(600).default(60),
  approvalPolicy: z.enum(["auto", "manual", "two_person"]).default("auto"),
  outputFormat: z.enum(["text", "json"]).default("text"),
  permissions: z.array(z.string()).optional()
});

export const workflowSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1),
        nodeType: z.string().min(1),
        name: z.string().min(1),
        config: jsonObjectSchema.default({}),
        dependsOn: z.array(z.string()).default([]),
        positionX: z.number().default(0),
        positionY: z.number().default(0)
      })
    )
    .min(2),
  edges: z.array(z.object({ from: z.string().min(1), to: z.string().min(1) })).default([])
});

const budgetSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
  maxCost: z.number().nonnegative().optional(),
  maxRuntimeMs: z.number().int().positive().optional(),
  maxToolCalls: z.number().int().positive().optional()
});

export const agentExecutionSchema = z.object({
  input: z.string().min(1),
  priority: z.number().int().min(0).max(100).default(0).optional(),
  budget: budgetSchema.optional(),
  timeoutSeconds: z.number().int().min(5).max(3600).optional(),
  maxIterations: z.number().int().min(1).max(200).optional(),
  idempotencyKey: z.string().min(8).max(200).optional()
});

export const workflowExecutionSchema = z.object({
  input: jsonObjectSchema.default({}).optional(),
  priority: z.number().int().min(0).max(100).default(0).optional(),
  budget: budgetSchema.optional(),
  timeoutSeconds: z.number().int().min(5).max(3600).optional(),
  idempotencyKey: z.string().min(8).max(200).optional()
});

export const memorySchema = z.object({
  scope: z.string().min(1).max(100),
  type: z.enum(["PROFILE", "PREFERENCE", "PROJECT", "FACT", "TASK", "DECISION", "CONTEXT"]),
  policy: z.enum(["NEVER_SAVE", "ASK_FIRST", "AUTO_SAVE_LOW_RISK"]).default("ASK_FIRST"),
  source: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1),
  content: z.string().min(1).max(10_000),
  projectId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  metadata: jsonObjectSchema.optional(),
  expiresAt: z.string().datetime().optional()
});

export const scheduleSchema = z.object({
  schedule: z.string().min(1).max(120),
  timezone: z.string().min(1).max(100).default("UTC"),
  input: jsonObjectSchema.optional()
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(2000).optional()
});

export const webhookTriggerSchema = z.object({
  allowedEvents: z.array(z.string().min(1)).default(["*"]).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(600).default(30).optional()
});
