type AttachmentLike = {
  id: string;
};

type WorkflowStepLike = {
  orderIndex: number;
  actionType: string;
  targetProvider: string;
  targetModel: string;
  sourceMode: string;
  sourceResultId?: string | null;
  instructionTemplate?: string | null;
};

type TargetLike = {
  provider: string;
  model: string;
};

type RunPayloadInput = {
  sessionId: string | null;
  projectId: string | null;
  title: string | null;
  originalInput: string;
  additionalInstruction: string;
  outputStyle: string;
  outputLanguage: string;
  attachments: AttachmentLike[];
  mode: "parallel" | "sequential";
  targets: TargetLike[];
  workflowSteps: WorkflowStepLike[];
  workflowControl: unknown;
};

export function buildWorkbenchRunPayload(input: RunPayloadInput) {
  return {
    sessionId: input.sessionId,
    projectId: input.projectId,
    title: input.title,
    originalInput: input.originalInput,
    additionalInstruction: input.additionalInstruction,
    outputStyle: input.outputStyle,
    outputLanguage: input.outputLanguage,
    attachmentIds: input.attachments.map((attachment) => attachment.id),
    mode: input.mode,
    targets: input.mode === "parallel" ? input.targets : undefined,
    steps:
      input.mode === "sequential"
        ? input.workflowSteps.map((step) => ({
            orderIndex: step.orderIndex,
            actionType: step.actionType,
            targetProvider: step.targetProvider,
            targetModel: step.targetModel,
            sourceMode: step.sourceMode,
            sourceResultId: step.sourceResultId,
            instructionTemplate: step.instructionTemplate,
          }))
        : undefined,
    workflowControl: input.mode === "sequential" ? input.workflowControl : undefined,
  };
}
