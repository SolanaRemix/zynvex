import { z } from "zod";

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
  timeoutSeconds: z.number().int().min(5).max(600).default(60)
});

export const workflowSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  nodes: z.array(
    z.object({
      nodeType: z.string().min(1),
      name: z.string().min(1),
      config: z.record(z.unknown()).default({}),
      positionX: z.number().default(0),
      positionY: z.number().default(0)
    })
  ).min(2)
});
