export type ProviderName = "openai" | "anthropic" | "google" | "xai";

const WORKFLOW_ACTION_TYPES_BASE = [
  "generate",
  "brainstorm",
  "critique",
  "fact_check",
  "improve",
  "summarize",
  "simplify",
  "consistency_review",
  "code_review",
] as const;

const BRANCH_REVIEW_ACTION_TYPES_BASE = [
  "brainstorm",
  "critique",
  "fact_check",
  "improve",
  "summarize",
  "simplify",
  "consistency_review",
  "code_review",
] as const;

export const ACTION_TYPES = [
  ...WORKFLOW_ACTION_TYPES_BASE,
  "follow_up",
  "scenario_develop",
  "deep_dive",
] as const;

export const WORKFLOW_ACTION_TYPES = [
  ...WORKFLOW_ACTION_TYPES_BASE,
  "scenario_develop",
  "deep_dive",
] as const;

export const BRANCH_REVIEW_ACTION_TYPES = [
  ...BRANCH_REVIEW_ACTION_TYPES_BASE,
  "scenario_develop",
  "deep_dive",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const WORKFLOW_STEP_ACTION_TYPES = [
  ...WORKFLOW_ACTION_TYPES,
  "follow_up",
] as const satisfies readonly ActionType[];

export const BRANCH_ACTION_TYPES = [
  ...BRANCH_REVIEW_ACTION_TYPES,
  "follow_up",
] as const satisfies readonly ActionType[];

export type SourceMode = "original" | "previous" | "selected_result" | "all_results";

export type ProviderCallInput = {
  provider: ProviderName;
  model: string;
  prompt: string;
  attachments?: ProviderAttachmentInput[];
  allowFallback?: boolean;
  disableInternalRetries?: boolean;
  enableWebSearch?: boolean;
  timeoutSecondsOverride?: number;
  abortSignal?: AbortSignal;
  concurrencyOwner?: {
    ownerKind?: string;
    ownerId?: string;
  };
};

export type ProviderAttachmentInput = {
  id: string;
  name: string;
  mimeType: string;
  kind: "TEXT" | "IMAGE" | "PDF";
  sizeBytes: number;
  extractedText?: string | null;
  dataBase64?: string;
};

export type UsageInfo = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ProviderCallResult = {
  provider: ProviderName;
  model: string;
  outputText: string;
  rawResponse: unknown;
  usage?: UsageInfo;
  latencyMs: number;
  estimatedCost?: number;
  costIsEstimated?: boolean;
  status: "completed" | "failed";
  errorMessage?: string;
};

export type WorkflowStepInput = {
  id?: string;
  orderIndex: number;
  actionType: ActionType;
  targetProvider: ProviderName;
  targetModel: string;
  sourceMode: SourceMode;
  sourceResultId?: string | null;
  instructionTemplate?: string | null;
};

export type WorkflowRepeatConfigInput = {
  enabled: boolean;
  startStepOrder: number;
  endStepOrder: number;
  repeatCount: number;
};

export type WorkflowRepeatBlockInput = {
  startStepOrder: number;
  endStepOrder: number;
  repeatCount: number;
};

export type WorkflowStopConditionInput = {
  enabled: boolean;
  checkStepOrder: number;
  qualityThreshold: number;
};

export type WorkflowControlInput = {
  repeat?: WorkflowRepeatConfigInput;
  repeatBlocks?: WorkflowRepeatBlockInput[];
  stopCondition?: WorkflowStopConditionInput;
};

export type TargetModelInput = {
  provider: ProviderName;
  model: string;
};
