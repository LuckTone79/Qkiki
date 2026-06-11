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
  /**
   * Set when prior results are delivered to the model in a separate prompt
   * block (e.g. the v2 queued runner appends them for token budgeting) rather
   * than inline via `sourceText`. Without this hint a brainstorm step would
   * lose its multi-model "yes, and" discussion directives.
   */
  hasPriorIdeas?: boolean;
};

const actionLabels: Record<ActionType, string> = {
  generate: "Generate the best possible answer to the user's task.",
  brainstorm:
    "Brainstorm divergently. Produce a wide spread of genuinely creative, unconventional ideas for the task instead of converging on the single obvious answer.",
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

/**
 * Heading used to introduce the source/prior-results block. Brainstorm steps
 * frame it as a living multi-model discussion to extend; other actions treat
 * it as a single source to work from. Exported so runners that deliver the
 * source as a separate prompt block stay consistent with `composePrompt`.
 */
export function getSourceHeading(actionType: ActionType) {
  return actionType === "brainstorm"
    ? "Ideas already on the table from other AI models (extend this living discussion, do not restate it):"
    : "Source result to use:";
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
    parts.push("", getSourceHeading(input.actionType), input.sourceText.trim());
  }

  if (input.actionType === "brainstorm") {
    const hasPriorIdeas =
      Boolean(input.sourceText?.trim()) || Boolean(input.hasPriorIdeas);
    parts.push("", ...buildBrainstormDirectives(hasPriorIdeas));
  }

  if (input.instructionTemplate?.trim()) {
    parts.push("", "Step-specific instruction:", input.instructionTemplate.trim());
  }

  parts.push("", "Return only the useful response content.");

  return parts.join("\n");
}

function buildBrainstormDirectives(hasPriorIdeas: boolean) {
  const lines = [
    "Brainstorming rules:",
    "- Think divergently: pull from unrelated fields, analogies, contrarian takes, and \"what if\" reframings. Do not stay narrowly inside the obvious framing of the topic.",
    "- Bring YOUR distinct perspective as this specific model. Aim for ideas the other models are unlikely to have produced.",
    "- Offer at least 5 distinct ideas. Give each a short bold title and a 1-2 sentence spark. Tag the boldest ones with [Wild card].",
    "- Prioritize originality and breadth over polish; half-formed but novel beats safe but generic.",
  ];

  if (hasPriorIdeas) {
    lines.push(
      "- Treat the ideas above as an ongoing multi-model brainstorm. Apply \"yes, and\": build on the strongest ones, remix two ideas into a new one, and add angles nobody has raised yet.",
      "- Do NOT summarize or merely rank the existing ideas, and do not repeat one already listed. Every item you add must be net-new or a genuine evolution.",
    );
  }

  lines.push(
    "- End with a short \"Threads worth pursuing\" note picking 1-2 directions with the most creative upside.",
  );

  return lines;
}
