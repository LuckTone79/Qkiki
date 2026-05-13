import type { ActionType } from "@/lib/ai/types";

type ComposePromptInput = {
  actionType: ActionType;
  originalInput: string;
  additionalInstruction?: string | null;
  projectContext?: string | null;
  outputStyle?: string | null;
  outputLanguage?: string | null;
  sourceText?: string | null;
  instructionTemplate?: string | null;
};

const actionLabels: Record<ActionType, string> = {
  generate: "Generate the best possible answer to the user's task.",
  critique:
    "Critique the source answer. Identify weak reasoning, missing context, unclear wording, and practical improvements.",
  fact_check:
    "Review the source answer for internal consistency and claims that may need verification. Do not claim live web verification.",
  improve:
    "Improve the source answer into a stronger final response while preserving useful ideas.",
  summarize:
    "Summarize the source answer clearly. Keep the most important decisions, risks, and next steps.",
  simplify:
    "Rewrite the source answer in simpler language for a non-specialist reader.",
  consistency_review:
    "Review the source answer for consistency with the original task and the user's additional instructions.",
  follow_up:
    "Answer the follow-up in the context of the selected source answer.",
};

export function getActionLabel(actionType: ActionType) {
  return actionLabels[actionType];
}

const outputLanguageNames: Record<string, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese",
  hi: "Hindi",
};

export function composePrompt(input: ComposePromptInput) {
  const parts = [
    "You are participating in a Qkiki Orchestration Workbench.",
    "Stay focused on the task, be explicit about uncertainty, and do not invent tool access.",
    "",
    `Action: ${actionLabels[input.actionType]}`,
    "",
    "Original user task:",
    input.originalInput.trim(),
  ];

  if (input.additionalInstruction?.trim()) {
    parts.push("", "Additional user instruction:", input.additionalInstruction.trim());
  }

  if (input.projectContext?.trim()) {
    parts.push(
      "",
      "Shared project context from related conversations:",
      input.projectContext.trim(),
    );
  }

  if (input.outputStyle?.trim()) {
    parts.push("", `Requested output style: ${input.outputStyle.trim()}`);
  }

  if (input.outputLanguage?.trim()) {
    const language =
      outputLanguageNames[input.outputLanguage.trim()] ||
      input.outputLanguage.trim();
    parts.push(
      "",
      `Default output language: ${language}. Use this language for the response unless the user's task explicitly asks for another language.`,
    );
  }

  if (input.sourceText?.trim()) {
    parts.push("", "Source result to use:", input.sourceText.trim());
  }

  if (input.instructionTemplate?.trim()) {
    parts.push("", "Step-specific instruction:", input.instructionTemplate.trim());
  }

  parts.push("", "Return only the useful response content.");

  return parts.join("\n");
}
