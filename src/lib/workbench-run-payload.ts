export type BuilderExperience = "simple" | "advanced";

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
  builderExperience: BuilderExperience;
};

export function buildWorkbenchRunPayload(input: RunPayloadInput) {
  const effectiveAdditionalInstruction =
    input.builderExperience === "advanced" ? input.additionalInstruction : "";
  const effectiveOutputStyle =
    input.builderExperience === "advanced" ? input.outputStyle : "detailed";
  const effectiveAttachmentIds =
    input.builderExperience === "advanced"
      ? input.attachments.map((attachment) => attachment.id)
      : [];
  const effectiveWorkflowControl =
    input.builderExperience === "advanced" ? input.workflowControl : undefined;

  return {
    sessionId: input.sessionId,
    projectId: input.projectId,
    title: input.title,
    originalInput: input.originalInput,
    additionalInstruction: effectiveAdditionalInstruction,
    outputStyle: effectiveOutputStyle,
    outputLanguage: input.outputLanguage,
    attachmentIds: effectiveAttachmentIds,
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
    workflowControl:
      input.mode === "sequential" ? effectiveWorkflowControl : undefined,
  };
}

