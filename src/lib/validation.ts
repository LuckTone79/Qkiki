import { z } from "zod";
import { isImageModel, isProviderName, PROVIDERS } from "./ai/provider-catalog.ts";
import { BRANCH_ACTION_TYPES, WORKFLOW_STEP_ACTION_TYPES } from "./ai/types.ts";

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
  actionType: z.enum(WORKFLOW_STEP_ACTION_TYPES),
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
  mode: z.enum(["parallel", "sequential", "image"]),
  targets: z.array(targetModelSchema).max(8).optional(),
  steps: z.array(workflowStepSchema).max(50).optional(),
  workflowControl: z
    .object({
      repeat: workflowRepeatSchema.optional(),
      repeatBlocks: z.array(workflowRepeatBlockSchema).max(10).optional(),
      stopCondition: workflowStopConditionSchema.optional(),
    })
    .optional(),
}).superRefine((value, ctx) => {
  if (value.mode !== "image") {
    return;
  }

  if (!value.targets?.length) {
    ctx.addIssue({
      code: "custom",
      path: ["targets"],
      message: "Select at least one image generation model.",
    });
    return;
  }

  value.targets.forEach((target, index) => {
    if (!isProviderName(target.provider) || !isImageModel(target.provider, target.model)) {
      ctx.addIssue({
        code: "custom",
        path: ["targets", index, "model"],
        message: "Image generation mode only accepts image generation models.",
      });
    }
  });
});

export const branchRunSchema = z.object({
  parentResultId: z.string().min(1),
  outputLanguage: z.enum(["en", "ko", "ja", "zh", "hi"]).nullable().optional(),
  actionType: z.enum(BRANCH_ACTION_TYPES),
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

// Credit-only coupons. Admin picks a duration (7 days / 30 days / lifetime) and
// either a fixed credit amount or "unlimited credits for the period". Multiple
// identical coupons can be created at once via `quantity`.
export const couponCreateSchema = z
  .object({
    duration: z.enum(["7d", "30d", "lifetime"]),
    unlimited: z.boolean().default(false),
    creditAmount: z.number().int().min(1).max(1000000).optional(),
    quantity: z.number().int().min(1).max(100).default(1),
    code: z.string().trim().max(64).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.unlimited && !value.creditAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["creditAmount"],
        message: "Credit amount is required unless the coupon is unlimited.",
      });
    }
    if (value.quantity > 1 && value.code) {
      ctx.addIssue({
        code: "custom",
        path: ["code"],
        message: "A custom code cannot be used when creating multiple coupons.",
      });
    }
  });

export const couponNoteUpdateSchema = z.object({
  note: z.string().trim().max(500).nullable().optional(),
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
