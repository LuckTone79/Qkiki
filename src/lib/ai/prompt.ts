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
  code_review:
    "Act as a senior code reviewer. Review the code produced by the previous model, find concrete issues, and return an improved version of the code. If the code is already high quality and has nothing worth changing, return it as-is instead of forcing changes.",
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
    const sourceHeading =
      input.actionType === "brainstorm"
        ? "Ideas already on the table from other AI models (extend this living discussion, do not restate it):"
        : input.actionType === "code_review"
          ? "Code from the previous model to review (this is the work you must review and, only where it genuinely helps, improve):"
          : "Source result to use:";
    parts.push("", sourceHeading, input.sourceText.trim());
  }

  if (input.actionType === "brainstorm") {
    parts.push("", ...buildBrainstormDirectives(Boolean(input.sourceText?.trim())));
  }

  if (input.actionType === "code_review") {
    parts.push("", ...buildCodeReviewDirectives());
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

function buildCodeReviewDirectives() {
  return [
    "Code review rules:",
    "- You are the next reviewer in a sequential review chain. The code above was written (or already reviewed) by an earlier model. Your job is to make it better only where it genuinely needs it.",
    "- First, silently inspect the code for real problems: correctness and edge-case bugs, security issues, performance pitfalls, error handling, readability and naming, dead or duplicated code, missing tests, and deviations from the task's requirements.",
    "- When you DO find issues worth fixing, apply the fixes and return the COMPLETE, runnable improved code (not just a diff or the changed lines), then add a short \"Changes\" list summarizing what you changed and why.",
    "- CRITICAL — do not force improvements. If the code is already high quality and you cannot find a change that is a clear, meaningful improvement, return the code EXACTLY as it is, unchanged, and add a single line: NO_CHANGES: the code is already high quality and needs no further changes.",
    "- Never invent cosmetic, trivial, or stylistic-only edits just to look productive. A no-change pass on already-good code is the correct and expected outcome, not a failure.",
    "- Preserve the original language, framework, structure, and public interfaces unless a change is truly necessary to fix a real problem.",
  ];
}
