import { z } from "zod";
import { PROVIDERS } from "@/lib/ai/provider-catalog";

const providerNames = PROVIDERS.map((provider) => provider.name) as [
  string,
  ...string[],
];

export const authEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

export const signUpSchema = z
  .object({
    name: z.string().trim().max(80).optional(),
    email: authEmailSchema,
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1).max(128),
});

export const adminSignInSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(1).max(128),
  mfaCode: z.string().trim().max(20).optional(),
});

export const targetModelSchema = z.object({
  provider: z.enum(providerNames),
  model: z.string().min(1).max(100),
});

export const workflowStepSchema = z.object({
  orderIndex: z.number().int().min(1).max(50),
  actionType: z.enum([
    "generate",
    "critique",
    "fact_check",
    "improve",
    "summarize",
    "simplify",
    "consistency_review",
    "follow_up",
  ]),
  targetProvider: z.enum(providerNames),
  targetModel: z.string().min(1).max(100),
  sourceMode: z.enum(["original", "previous", "selected_result", "all_results"]),
  sourceResultId: z.string().nullable().optional(),
  instructionTemplate: z.string().max(4000).nullable().optional(),
});

export const workflowRepeatSchema = z.object({
  enabled: z.boolean(),
  startStepOrder: z.number().int().min(1).max(50),
  endStepOrder: z.number().int().min(1).max(50),
  repeatCount: z.number().int().min(1).max(50),
});

export const workflowRepeatBlockSchema = z.object({
  startStepOrder: z.number().int().min(1).max(50),
  endStepOrder: z.number().int().min(1).max(50),
  repeatCount: z.number().int().min(1).max(50),
});

export const workflowStopConditionSchema = z.object({
  enabled: z.boolean(),
  checkStepOrder: z.number().int().min(1).max(50),
  qualityThreshold: z.number().int().min(0).max(100),
});

export const runWorkbenchSchema = z.object({
  sessionId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  originalInput: z.string().min(1).max(20000),
  additionalInstruction: z.string().max(8000).nullable().optional(),
  outputStyle: z.string().max(80).nullable().optional(),
  outputLanguage: z.enum(["en", "ko", "ja", "zh", "hi"]).nullable().optional(),
  attachmentIds: z.array(z.string().min(1)).max(8).optional(),
  mode: z.enum(["parallel", "sequential"]),
  targets: z.array(targetModelSchema).max(8).optional(),
  steps: z.array(workflowStepSchema).max(50).optional(),
  workflowControl: z
    .object({
      repeat: workflowRepeatSchema.optional(),
      repeatBlocks: z.array(workflowRepeatBlockSchema).max(10).optional(),
      stopCondition: workflowStopConditionSchema.optional(),
    })
    .optional(),
});

export const branchRunSchema = z.object({
  parentResultId: z.string().min(1),
  outputLanguage: z.enum(["en", "ko", "ja", "zh", "hi"]).nullable().optional(),
  actionType: z.enum([
    "critique",
    "fact_check",
    "improve",
    "summarize",
    "simplify",
    "consistency_review",
    "follow_up",
  ]),
  instruction: z.string().min(1).max(8000),
  targets: z.array(targetModelSchema).min(1).max(4),
});

export const presetSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  workflowJson: z.string().min(2).max(20000),
});

export const projectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  sharedContext: z.string().trim().max(12000).optional(),
});

export const couponCreateSchema = z.object({
  type: z.enum([
    "MONTHLY_FREE_30D",
    "MONTHLY_FREE_30D_DAILY_50",
    "LIFETIME_FREE",
    "LIFETIME_FREE_DAILY_50",
  ]),
  code: z.string().trim().max(64).optional(),
  note: z.string().trim().max(500).optional(),
});

export const couponRedeemSchema = z.object({
  code: z.string().trim().min(3).max(64),
});

export const manualGrantSchema = z.object({
  type: z.enum(["MONTHLY_FREE_30D", "LIFETIME_FREE"]),
  note: z.string().trim().max(500).optional(),
});

export const adminProviderConfigSchema = z.object({
  providerName: z.enum(providerNames),
  isEnabled: z.boolean(),
  defaultModel: z.string().min(1).max(100),
  fallbackProvider: z.enum(providerNames).nullable().optional(),
  perUserDailyLimit: z.number().int().min(1).max(100000).optional(),
  timeoutSeconds: z.number().int().min(30).max(900).optional(),
  apiKey: z.string().max(4000).optional(),
  clearStoredKey: z.boolean().optional(),
});

export type RunWorkbenchInput = z.infer<typeof runWorkbenchSchema>;
export type BranchRunInput = z.infer<typeof branchRunSchema>;
