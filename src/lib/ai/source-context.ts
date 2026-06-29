import { textOutputForPrompt } from "./image-output.ts";
import type { SourceMode } from "@/lib/ai/types";

export type SourceContextKind =
  | "original"
  | "prior_result"
  | "prior_results"
  | "original_fallback";

type SourceModeLike = SourceMode | "branch";

export type SourceContextSegment = {
  key: "latest" | "older";
  priority: "highest" | "medium";
  text: string;
};

export type SourcePromptBlockPriority = "highest" | "medium" | "low";

export type V2SourcePromptBlock = {
  key: string;
  priority: SourcePromptBlockPriority;
  protected: boolean;
  sourceContextKind: SourceContextKind;
  text: string;
};

export type ResolvedSourceContext = {
  text: string;
  kind: SourceContextKind;
  segments?: SourceContextSegment[];
};

function normalizeText(text: string | null | undefined) {
  return text?.trim() || "";
}

export function requireUsableCompletedSource(
  input: { status: string | null | undefined; outputText?: string | null | undefined },
  label: string,
) {
  if (input.status !== "completed") {
    throw new Error(`${label} requires a completed source.`);
  }

  const text = textOutputForPrompt(input.outputText).trim();
  if (!text) {
    throw new Error(`${label} requires a completed source with non-empty output.`);
  }

  return text;
}

export function isPriorSourceContextKind(kind: SourceContextKind) {
  return kind === "prior_result" || kind === "prior_results";
}

export function buildV2SourcePromptBlocks(input: {
  sourceContext: ResolvedSourceContext;
  defaultPriority: SourcePromptBlockPriority;
  protectSingleSource?: boolean;
}): V2SourcePromptBlock[] {
  const { sourceContext } = input;

  if (!sourceContext.text.trim() || sourceContext.kind === "original") {
    return [];
  }

  if (sourceContext.kind === "prior_results" && sourceContext.segments?.length) {
    return sourceContext.segments.map((segment) => ({
      key: `source-${segment.key}`,
      priority: segment.key === "latest" ? "highest" : "medium",
      protected: segment.key === "latest",
      sourceContextKind: segment.key === "latest" ? "prior_result" : "prior_results",
      text: segment.text,
    }));
  }

  return [
    {
      key: "source",
      priority: input.defaultPriority,
      protected: Boolean(input.protectSingleSource),
      sourceContextKind: sourceContext.kind,
      text: sourceContext.text,
    },
  ];
}

export function classifySourceContextKind(input: {
  sourceMode: SourceModeLike;
  hasUsablePriorSource: boolean;
  completedSourceCount?: number;
}): SourceContextKind {
  if (input.sourceMode === "original") {
    return "original";
  }

  if (input.sourceMode === "branch") {
    if (!input.hasUsablePriorSource) {
      throw new Error("branch sources require a usable completed source.");
    }
    return "prior_result";
  }

  if (input.sourceMode === "selected_result") {
    if (!input.hasUsablePriorSource) {
      throw new Error("selected_result requires a usable completed source.");
    }
    return "prior_result";
  }

  if (input.sourceMode === "all_results") {
    return (input.completedSourceCount ?? 0) > 0
      ? "prior_results"
      : "original_fallback";
  }

  return input.hasUsablePriorSource ? "prior_result" : "original_fallback";
}

export function resolveSourceContext(input: {
  sourceMode: SourceModeLike;
  originalText?: string | null;
  priorText?: string | null;
  allResultsTexts?: Array<string | null | undefined>;
  fallbackText?: string | null;
  includeSourceSegments?: boolean;
}): ResolvedSourceContext {
  const originalText = normalizeText(input.originalText);
  const priorText = normalizeText(input.priorText);
  const fallbackText = normalizeText(input.fallbackText) || originalText;
  const completedTexts = (input.allResultsTexts || [])
    .map((text) => normalizeText(text))
    .filter(Boolean);

  if (input.sourceMode === "original") {
    return {
      kind: "original",
      text: originalText,
    };
  }

  if (input.sourceMode === "selected_result" || input.sourceMode === "branch") {
    if (!priorText) {
      throw new Error(`${input.sourceMode} requires a usable completed source.`);
    }

    return {
      kind: "prior_result",
      text: priorText,
    };
  }

  if (input.sourceMode === "previous") {
    if (priorText) {
      return {
        kind: "prior_result",
        text: priorText,
      };
    }

    return {
      kind: "original_fallback",
      text: fallbackText,
    };
  }

  if (!completedTexts.length) {
    return {
      kind: "original_fallback",
      text: fallbackText,
    };
  }

  const latest = completedTexts[completedTexts.length - 1] || "";
  const older = completedTexts.slice(0, -1).reverse();

  return {
    kind: "prior_results",
    text: completedTexts.join("\n\n"),
    segments: input.includeSourceSegments
      ? [
          { key: "latest", priority: "highest", text: latest },
          ...(older.length
            ? [{ key: "older" as const, priority: "medium" as const, text: older.join("\n\n") }]
            : []),
        ]
      : undefined,
  };
}
