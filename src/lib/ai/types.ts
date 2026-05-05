export type ProviderName = "openai" | "anthropic" | "google" | "xai";

export type ActionType =
  | "generate"
  | "critique"
  | "fact_check"
  | "improve"
  | "summarize"
  | "simplify"
  | "consistency_review"
  | "follow_up";

export type SourceMode = "original" | "previous" | "selected_result" | "all_results";

export type ProviderCallInput = {
  provider: ProviderName;
  model: string;
  prompt: string;
  attachments?: ProviderAttachmentInput[];
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

export type WorkflowStopConditionInput = {
  enabled: boolean;
  checkStepOrder: number;
  qualityThreshold: number;
};

export type WorkflowControlInput = {
  repeat?: WorkflowRepeatConfigInput;
  stopCondition?: WorkflowStopConditionInput;
};

export type TargetModelInput = {
  provider: ProviderName;
  model: string;
};
