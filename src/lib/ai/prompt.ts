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
  currentDate?: Date;
};

const actionLabels: Record<ActionType, string> = {
  generate: "Generate the best possible answer to the user's task.",
  brainstorm:
    "Brainstorm divergently. Produce a wide spread of genuinely creative, unconventional ideas for the task instead of converging on the single obvious answer.",
  critique:
    "Critique the source answer. Identify weak reasoning, missing context, unclear wording, and practical improvements.",
  fact_check:
    "Review the source answer for internal consistency, source-grounded factual accuracy, missing context, and your own model assessment.",
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

/**
 * Image-generation models take the visual description directly. We deliberately
 * skip the orchestration boilerplate (role framing, output language/style,
 * "return only the response" directives) that `composePrompt` adds for text
 * models, because that text would otherwise be drawn into the generated image.
 */
export function composeImagePrompt(input: {
  originalInput: string;
  additionalInstruction?: string | null;
}) {
  return [input.originalInput, input.additionalInstruction]
    .map((part) => part?.trim() || "")
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Heading used to introduce the source/prior-results block. Brainstorm steps
 * frame it as a living multi-model discussion to extend; other actions treat
 * it as a single source to work from. Exported so runners that deliver the
 * source as a separate prompt block stay consistent with `composePrompt`.
 */
export function getSourceHeading(actionType: ActionType) {
  if (actionType === "brainstorm") {
    return "Ideas already on the table from other AI models (extend this living discussion, do not restate it):";
  }

  if (actionType === "code_review") {
    return "Code from the previous model to review (this is the work you must review and, only where it genuinely helps, improve):";
  }

  return "Source result to use:";
}

const outputLanguageNames: Record<string, string> = {
  en: "English",
  ko: "Korean",
  ja: "Japanese",
  zh: "Chinese",
  hi: "Hindi",
};

const freshnessPattern = new RegExp(
  [
    "\\b(today|tonight|tomorrow|yesterday|current|currently|latest|recent|newest|now|live|real[- ]?time|breaking|news|price|prices|schedule|fixture|weather|ranking|rankings|odds|market|release|version|202[4-9]|203\\d)\\b",
    "\\uC624\\uB298",
    "\\uB0B4\\uC77C",
    "\\uC5B4\\uC81C",
    "\\uD604\\uC7AC",
    "\\uCD5C\\uC2E0",
    "\\uCD5C\\uADFC",
    "\\uC2E4\\uC2DC\\uAC04",
    "\\uB274\\uC2A4",
    "\\uAC00\\uACA9",
    "\\uC2DC\\uC138",
    "\\uC77C\\uC815",
    "\\uACBD\\uAE30",
    "\\uC6D4\\uB4DC\\uCEF5",
    "\\uB7AD\\uD0B9",
    "\\uC21C\\uC704",
    "\\uBC30\\uB2F9",
    "\\uD658\\uC728",
    "\\uB0A0\\uC528",
    "\\uCD9C\\uC2DC",
    "\\uBC84\\uC804",
    "\\uAC80\\uC0C9",
    "\\uC6F9\\uAC80\\uC0C9",
    "\\uD329\\uD2B8",
    "\\uAC80\\uC99D",
  ].join("|"),
  "i",
);

export function shouldPreferWebSearch(input: {
  actionType: ActionType;
  originalInput?: string | null;
  additionalInstruction?: string | null;
  sourceText?: string | null;
  instructionTemplate?: string | null;
}) {
  if (input.actionType === "fact_check" || input.actionType === "consistency_review") {
    return true;
  }

  const text = [
    input.originalInput,
    input.additionalInstruction,
    input.sourceText,
    input.instructionTemplate,
  ]
    .filter(Boolean)
    .join("\n");

  return freshnessPattern.test(text);
}

function formatCurrentContext(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return [
    "Current time context:",
    `- UTC: ${now.toISOString()}`,
    `- Asia/Seoul: ${formatter.format(now)}`,
    "- Resolve relative dates such as today, tomorrow, yesterday, current, latest, or recent against this timestamp before answering.",
  ];
}

function buildFreshnessDirectives() {
  return [
    "Freshness and web research rules:",
    "- For current, recent, scheduled, numerical, legal, financial, sports, product, model, release, pricing, weather, ranking, or otherwise time-sensitive claims, use web search, grounding, browsing, or live-search tools if this runtime exposes them.",
    "- Do not stop at 'not verified' when a simple web search could verify the fact. Search first, then answer from the freshest available evidence.",
    "- Cite or name the sources and include the checked date when using live or web-grounded information.",
    "- If search tools are unavailable or blocked, say that clearly, then give a best-effort answer with assumptions and uncertainty separated from verified facts.",
  ];
}

function buildFactCheckDirectives() {
  return [
    "Fact-check review requirements:",
    "- Check the source answer against the original task, current facts, and missing context; do not limit the review to the source answer's internal claims.",
    "- Include a section titled 'Your own assessment' that gives this model's independent judgment, corrected answer, or preferred estimate after the checks.",
    "- Distinguish verified facts, likely assumptions, and your analytical opinion.",
  ];
}

export function composePrompt(input: ComposePromptInput) {
  const preferWebSearch = shouldPreferWebSearch(input);
  const parts = [
    "You are participating in a Yapp Orchestration Workbench.",
    "Stay focused on the task, be explicit about uncertainty, and do not invent tool access.",
    "",
    ...formatCurrentContext(input.currentDate ?? new Date()),
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

  if (preferWebSearch) {
    parts.push("", ...buildFreshnessDirectives());
  }

  if (input.actionType === "fact_check") {
    parts.push("", ...buildFactCheckDirectives());
  }

  if (input.actionType === "brainstorm") {
    const hasPriorIdeas =
      Boolean(input.sourceText?.trim()) || Boolean(input.hasPriorIdeas);
    parts.push("", ...buildBrainstormDirectives(hasPriorIdeas));
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
