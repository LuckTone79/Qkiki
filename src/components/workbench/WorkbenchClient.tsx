"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { LimitReachedModal } from "@/components/billing/LimitReachedModal";
import { UsageStatus } from "@/components/billing/UsageStatus";
import {
  type AppLanguage,
  useLanguage,
} from "@/components/i18n/LanguageProvider";
import {
  ProviderOption,
  ProviderSelectorRow,
} from "@/components/workbench/ProviderSelectorRow";
import {
  WorkflowStepRow,
  WorkflowStepState,
} from "@/components/workbench/WorkflowStepRow";
import {
  ResultCard,
  WorkbenchResult,
} from "@/components/workbench/ResultCard";
import type {
  ActionType,
  ProviderName,
  TargetModelInput,
  WorkflowControlInput,
} from "@/lib/ai/types";
import {
  saveDraft,
  loadDraft,
  clearDraft,
  readUsageCache,
  writeUsageCache,
  writeSessionCache,
  readSessionCache,
} from "@/lib/local-cache";
import { getModelDisplayName } from "@/lib/ai/model-display";
import type { UsageErrorPayload, UsageStatus as UsageStatusType } from "@/lib/usage-types";

type ProviderSelection = {
  enabled: boolean;
  models: string[];
};

type MobilePanel = "models" | "input" | "workflow" | "results";

type Preset = {
  id: string;
  name: string;
  description: string | null;
  workflowJson: string;
};

type LoadedSession = {
  id: string;
  projectId: string | null;
  title: string;
  originalInput: string;
  additionalInstruction: string | null;
  outputStyle: string | null;
  outputLanguage?: string | null;
  mode: string;
  finalResultId: string | null;
  workflowSteps: Array<{
    id: string;
    orderIndex: number;
    actionType: ActionType;
    targetProvider: ProviderName;
    targetModel: string;
    sourceMode: WorkflowStepState["sourceMode"];
    sourceResultId: string | null;
    instructionTemplate: string | null;
  }>;
  project: {
    id: string;
    name: string;
    description?: string | null;
    sharedContext: string | null;
  } | null;
  attachments: WorkbenchAttachment[];
  results: WorkbenchResult[];
};

type WorkbenchAttachment = {
  id: string;
  name: string;
  mimeType: string;
  kind: "TEXT" | "IMAGE" | "PDF";
  sizeBytes: number;
  createdAt: string;
};

type ProjectMeta = {
  id: string;
  name: string;
  description: string | null;
  sharedContext: string | null;
};

type WorkflowControlState = {
  repeatEnabled: boolean;
  repeatStartStep: number;
  repeatEndStep: number;
  repeatCount: number;
  stopConditionEnabled: boolean;
  stopConditionStep: number;
  qualityThreshold: number;
};

type ResultLayout = "single" | "double";

type RunProgressStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "skipped";

type RunProgressEntry = {
  key: string;
  title: string;
  subtitle: string;
  status: RunProgressStatus;
  detail?: string | null;
  workLines?: [string, string];
};

type RunMonitor = {
  mode: "parallel" | "sequential";
  startedAt: number;
  entries: RunProgressEntry[];
};

type OutputLanguage = "en" | "ko" | "ja" | "zh" | "hi";

type WorkbenchRunStreamEvent =
  | {
      type: "session";
      session: { id: string; title: string; finalResultId?: string | null };
    }
  | {
      type: "progress";
      index: number;
      title?: string;
      subtitle?: string;
      status?: RunProgressStatus;
      detail?: string;
    }
  | {
      type: "result";
      index: number;
      result: WorkbenchResult;
    }
  | {
      type: "usage";
      usage: UsageStatusType;
    }
  | {
      type: "done";
      session?: { id: string; title: string; finalResultId?: string | null };
      results?: WorkbenchResult[];
      executionSummary?: {
        plannedTotal: number;
        executedTotal: number;
        stoppedEarly: boolean;
        stopReason?: string | null;
      };
      usage?: UsageStatusType;
    }
  | {
      type: "error";
      error?: string;
      code?: string;
      redirectUrl?: string;
      usage?: UsageStatusType;
    };

type ParallelComparisonSummary = {
  summary: string;
  provider: ProviderName;
  model: string;
  generatedAt: string;
  comparedResultIds: string[];
};

type ParallelComparisonState =
  | {
      signature: string;
      status: "idle";
    }
  | {
      signature: string;
      status: "loading";
    }
  | {
      signature: string;
      status: "completed";
      comparison: ParallelComparisonSummary;
    }
  | {
      signature: string;
      status: "failed";
      error: string;
    };

const outputStyles = ["detailed", "short", "bullet", "table", "executive"];
const outputStyleLabels: Record<string, Record<AppLanguage, string>> = {
  detailed: { en: "detailed", ko: "\uc790\uc138\ud788" },
  short: { en: "short", ko: "\uc9e7\uac8c" },
  bullet: { en: "bullet", ko: "\uae00\uba38\ub9ac\ud45c" },
  table: { en: "table", ko: "\ud45c" },
  executive: { en: "executive", ko: "\uc784\uc6d0 \uc694\uc57d" },
};

const outputLanguages: OutputLanguage[] = ["en", "ko", "ja", "zh", "hi"];
const outputLanguageLabels: Record<OutputLanguage, string> = {
  en: "English",
  ko: "\ud55c\uad6d\uc5b4",
  ja: "\u65e5\u672c\u8a9e",
  zh: "\u4e2d\u6587",
  hi: "\u0939\u093f\u0928\u094d\u0926\u0940",
};

const MAX_TEMPLATE_STEPS = 50;
const MAX_TOTAL_SEQUENTIAL_EXECUTIONS = 50;
const ATTACHMENT_ACCEPT =
  ".txt,.md,.csv,.json,.pdf,image/png,image/jpeg,image/webp,image/gif";
const MAX_ATTACHMENTS_PER_RUN = 8;

const draftText = {
  en: {
    restored: "Unsaved draft restored",
    dismiss: "Dismiss",
  },
  ko: {
    restored: "\uc784\uc2dc \uc800\uc7a5\ub41c \uc791\uc5c5\uc744 \ubcf5\uc6d0\ud588\uc2b5\ub2c8\ub2e4",
    dismiss: "\ub2eb\uae30",
  },
} as const;

const workflowBuilderText: Record<
  AppLanguage,
  {
    repeatSettings: string;
    repeatRange: string;
    repeatStart: string;
    repeatEnd: string;
    repeatCount: string;
    estimatedTotal: string;
    totalLimitNotice: string;
    stopCondition: string;
    stopAtStep: string;
    qualityThreshold: string;
    qualityUnit: string;
    addStepLimit: string;
    minimumStepNotice: string;
    stopConditionHint: string;
    repeatedBlock: string;
  }
> = {
  en: {
    repeatSettings: "Repeat settings",
    repeatRange: "Repeat range",
    repeatStart: "Start step",
    repeatEnd: "End step",
    repeatCount: "Repeat count",
    estimatedTotal: "Estimated total sequential executions",
    totalLimitNotice: "Total sequential executions must be 50 or fewer.",
    stopCondition: "Early stop condition",
    stopAtStep: "Check at step",
    qualityThreshold: "Quality threshold",
    qualityUnit: "points",
    addStepLimit: "Maximum step templates reached (50).",
    minimumStepNotice: "At least one workflow step is required.",
    stopConditionHint:
      "When enabled, the selected step self-evaluates quality and can stop the run early.",
    repeatedBlock: "Repeated block",
  },
  ko: {
    repeatSettings: "\uBC18\uBCF5 \uC124\uC815",
    repeatRange: "\uBC18\uBCF5 \uAD6C\uAC04",
    repeatStart: "\uC2DC\uC791 \uB2E8\uACC4",
    repeatEnd: "\uC885\uB8CC \uB2E8\uACC4",
    repeatCount: "\uBC18\uBCF5 \uD69F\uC218",
    estimatedTotal: "\uC608\uC0C1 \uC21C\uCC28 \uC2E4\uD589 \uCD1D\uD69F\uC218",
    totalLimitNotice:
      "\uC21C\uCC28 \uCD1D \uC2E4\uD589 \uD69F\uC218\uB294 50\uD68C\uB97C \uB118\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.",
    stopCondition: "\uC870\uAE30 \uC885\uB8CC \uC870\uAC74",
    stopAtStep: "\uD310\uB2E8 \uB2E8\uACC4",
    qualityThreshold: "\uD488\uC9C8 \uAE30\uC900\uC810\uC218",
    qualityUnit: "\uC810",
    addStepLimit:
      "\uB2E8\uACC4 \uD15C\uD50C\uB9BF\uC740 \uCD5C\uB300 50\uAC1C\uAE4C\uC9C0\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4.",
    minimumStepNotice:
      "\uC6CC\uD06C\uD50C\uB85C\uC6B0 \uB2E8\uACC4\uB294 \uCD5C\uC18C 1\uAC1C\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.",
    stopConditionHint:
      "\uCF1C\uB450\uBA74 \uC120\uD0DD\uD55C \uB2E8\uACC4\uAC00 \uC790\uCCB4 \uD488\uC9C8\uC810\uC218\uB97C \uD310\uB2E8\uD558\uACE0 \uC870\uAE30 \uC885\uB8CC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    repeatedBlock: "\uBC18\uBCF5 \uAD6C\uAC04",
  },
};

const workbenchUiText = {
  en: {
    progressTitle: "AI progress",
    progressDescription:
      "Live status text for each run. This shows work stages, not private chain-of-thought.",
    resultOverview: "Result overview",
    resultLayout: "Result layout",
    resultLayoutSingle: "1 column",
    resultLayoutDouble: "2 columns",
    totalResults: "Total",
    completedResults: "Completed",
    failedResults: "Failed",
    runningResults: "Running",
    finalSelection: "Final",
    finalPending: "Not selected",
    queued: "Queued and waiting to start.",
    preparing: "Preparing the prompt and context.",
    running: "The model is generating a response.",
    wrapping: "Saving the output and updating the result card.",
    completed: "Output received and saved.",
    failed: "The run ended with an error.",
    skipped: "Skipped because the sequence stopped early.",
    parallelRun: "Parallel run",
    sequentialStep: "Step",
    noProgress: "Run a task to see per-model progress updates here.",
    compareTitle: "AI difference summary",
    compareDescription:
      "Top-level parallel results are compared model by model, with shared points and differences summarized below.",
    compareLoading: "Comparing completed parallel results now.",
    compareEmpty:
      "Complete at least two top-level parallel results to generate a difference summary.",
    compareFailed: "Could not generate the difference summary.",
    compareGeneratedWith: "Compared with",
    compareModels: "Compared models",
  },
  ko: {
    progressTitle: "AI 진행 상태",
    progressDescription:
      "각 실행의 현재 단계를 텍스트로 보여줍니다. 내부 사고 전체가 아니라 작업 단계 상태입니다.",
    resultOverview: "결과 개요",
    resultLayout: "결과 배치",
    resultLayoutSingle: "1열",
    resultLayoutDouble: "2열",
    totalResults: "전체",
    completedResults: "완료",
    failedResults: "실패",
    runningResults: "진행중",
    finalSelection: "최종 선택",
    finalPending: "미선택",
    queued: "대기열에 있으며 아직 시작 전입니다.",
    preparing: "프롬프트와 맥락을 준비하고 있습니다.",
    running: "모델이 응답을 생성하고 있습니다.",
    wrapping: "출력을 저장하고 결과 카드를 정리하고 있습니다.",
    completed: "출력을 받아 저장했습니다.",
    failed: "실행이 오류와 함께 종료되었습니다.",
    skipped: "순차 실행이 조기 종료되어 건너뛰었습니다.",
    parallelRun: "병렬 실행",
    sequentialStep: "단계",
    noProgress: "작업을 실행하면 여기에서 모델별 진행 상태를 확인할 수 있습니다.",
    compareTitle: "AI 결과 차이 비교",
    compareDescription:
      "병렬 비교에서 완료된 상위 결과를 모델별로 비교해 공통점과 차이점을 요약합니다.",
    compareLoading: "완료된 병렬 결과의 차이점을 비교하고 있습니다.",
    compareEmpty:
      "차이 비교 요약을 생성하려면 상위 병렬 결과가 최소 2개 이상 필요합니다.",
    compareFailed: "결과 차이 요약을 생성하지 못했습니다.",
    compareGeneratedWith: "비교 생성 모델",
    compareModels: "비교 대상 모델",
  },
} as const;

function newUid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function defaultPresetName(language: AppLanguage) {
  return language === "ko"
    ? "3\ub2e8\uacc4 \uac80\ud1a0 \uccb4\uc778"
    : "Three-step review chain";
}

function defaultPresetDescription(language: AppLanguage) {
  return language === "ko"
    ? "\uc0dd\uc131, \ube44\ud310, \uac1c\uc120."
    : "Generate, critique, and improve.";
}

function initialSteps(language: AppLanguage): WorkflowStepState[] {
  return [
    {
      uid: newUid(),
      orderIndex: 1,
      actionType: "generate",
      targetProvider: "openai",
      targetModel: "gpt-5.4-mini",
      sourceMode: "original",
      instructionTemplate:
        language === "ko"
          ? "\uac15\ud55c \uccab \ub2f5\ubcc0\uc744 \uc791\uc131\ud558\uc138\uc694."
          : "Draft a strong first answer.",
    },
    {
      uid: newUid(),
      orderIndex: 2,
      actionType: "critique",
      targetProvider: "xai",
      targetModel: "grok-4.3",
      sourceMode: "previous",
      instructionTemplate:
        language === "ko"
          ? "\uacb0\ud568\uacfc \ube60\uc9c4 \uad00\uc810\uc744 \uad6c\uccb4\uc801\uc73c\ub85c \uc9da\uc5b4\uc8fc\uc138\uc694."
          : "Be concrete about flaws and missing angles.",
    },
    {
      uid: newUid(),
      orderIndex: 3,
      actionType: "improve",
      targetProvider: "google",
      targetModel: "gemini-2.5-flash",
      sourceMode: "previous",
      instructionTemplate:
        language === "ko"
          ? "\ube44\ud310 \ub0b4\uc6a9\uc744 \ub354 \ub098\uc740 \ubc84\uc804\uc73c\ub85c \ubc14\uafb8\uc138\uc694."
          : "Turn the critique into a better version.",
    },
  ];
}

function sortSteps(steps: WorkflowStepState[]) {
  return steps
    .map((step, index) => ({ ...step, orderIndex: index + 1 }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function normalizeStepsForProviders(
  steps: WorkflowStepState[],
  providers: ProviderOption[],
) {
  return sortSteps(
    steps.map((step) => {
      const provider = providers.find(
        (item) => item.providerName === step.targetProvider,
      );

      if (!provider || provider.models.includes(step.targetModel)) {
        return step;
      }

      return {
        ...step,
        targetModel: provider.defaultModel,
      };
    }),
  );
}

function dedupeModels(models: string[]) {
  return Array.from(new Set(models));
}

function normalizeProviderSelection(
  selection: (Partial<ProviderSelection> & { model?: string }) | undefined,
  provider: ProviderOption,
): ProviderSelection {
  const nextModels = dedupeModels([
    ...(Array.isArray(selection?.models) ? selection.models : []),
    ...(typeof selection?.model === "string" ? [selection.model] : []),
  ]).filter((model) => provider.models.includes(model));

  return {
    enabled: selection?.enabled ?? provider.isEnabled,
    models: nextModels.length ? nextModels : [],
  };
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function mergeAttachments(
  current: WorkbenchAttachment[],
  incoming: WorkbenchAttachment[],
) {
  const map = new Map(current.map((attachment) => [attachment.id, attachment]));
  incoming.forEach((attachment) => map.set(attachment.id, attachment));
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function formatFileSize(sizeBytes: number, language: AppLanguage) {
  const units = language === "ko" ? ["B", "KB", "MB", "GB"] : ["B", "KB", "MB", "GB"];
  let value = sizeBytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}${units[unitIndex]}`;
}

function attachmentKindLabel(
  kind: WorkbenchAttachment["kind"],
  language: AppLanguage,
) {
  if (language === "ko") {
    if (kind === "TEXT") return "텍스트";
    if (kind === "IMAGE") return "이미지";
    return "PDF";
  }

  if (kind === "TEXT") return "Text";
  if (kind === "IMAGE") return "Image";
  return "PDF";
}

function defaultWorkflowControlState(): WorkflowControlState {
  return {
    repeatEnabled: false,
    repeatStartStep: 1,
    repeatEndStep: 3,
    repeatCount: 2,
    stopConditionEnabled: false,
    stopConditionStep: 2,
    qualityThreshold: 90,
  };
}

function normalizeWorkflowControlState(
  control: WorkflowControlState,
  stepCount: number,
) {
  const maxStep = Math.max(1, stepCount);
  const repeatStartStep = clampInteger(control.repeatStartStep, 1, maxStep);
  const repeatEndStep = clampInteger(control.repeatEndStep, repeatStartStep, maxStep);
  const stopConditionStep = clampInteger(control.stopConditionStep, 1, maxStep);

  return {
    ...control,
    repeatStartStep,
    repeatEndStep,
    repeatCount: clampInteger(control.repeatCount, 1, MAX_TOTAL_SEQUENTIAL_EXECUTIONS),
    stopConditionStep,
    qualityThreshold: clampInteger(control.qualityThreshold, 0, 100),
  };
}

function calculateSequentialExecutionCount(
  stepCount: number,
  control: WorkflowControlState,
) {
  if (!stepCount) {
    return 0;
  }

  if (!control.repeatEnabled) {
    return stepCount;
  }

  const start = clampInteger(control.repeatStartStep, 1, stepCount);
  const end = clampInteger(control.repeatEndStep, start, stepCount);
  const repeatedLength = end - start + 1;
  const prefix = start - 1;
  const suffix = stepCount - end;
  return prefix + repeatedLength * clampInteger(control.repeatCount, 1, 50) + suffix;
}

function workflowControlFromPreset(
  parsed: Record<string, unknown>,
  currentStepCount: number,
) {
  const fallback = normalizeWorkflowControlState(
    defaultWorkflowControlState(),
    currentStepCount,
  );
  const candidate = parsed.workflowControl as
    | WorkflowControlInput
    | undefined;

  if (!candidate) {
    return fallback;
  }

  return normalizeWorkflowControlState(
    {
      repeatEnabled: candidate.repeat?.enabled ?? false,
      repeatStartStep: candidate.repeat?.startStepOrder ?? fallback.repeatStartStep,
      repeatEndStep: candidate.repeat?.endStepOrder ?? fallback.repeatEndStep,
      repeatCount: candidate.repeat?.repeatCount ?? fallback.repeatCount,
      stopConditionEnabled: candidate.stopCondition?.enabled ?? false,
      stopConditionStep:
        candidate.stopCondition?.checkStepOrder ?? fallback.stopConditionStep,
      qualityThreshold:
        candidate.stopCondition?.qualityThreshold ?? fallback.qualityThreshold,
    },
    currentStepCount,
  );
}

function mergeResults(current: WorkbenchResult[], incoming: WorkbenchResult[]) {
  const map = new Map(current.map((result) => [result.id, result]));
  incoming.forEach((result) => map.set(result.id, result));
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function sortResultsForDisplay(results: WorkbenchResult[], mode: "parallel" | "sequential") {
  if (mode !== "parallel") {
    return [...results].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  const childrenByParent = new Map<string, WorkbenchResult[]>();
  const roots: WorkbenchResult[] = [];

  for (const result of results) {
    if (!result.parentResultId) {
      roots.push(result);
      continue;
    }

    const siblings = childrenByParent.get(result.parentResultId) ?? [];
    siblings.push(result);
    childrenByParent.set(result.parentResultId, siblings);
  }

  const sortByCreatedAt = (items: WorkbenchResult[]) =>
    [...items].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const rootCompletionRank = (result: WorkbenchResult) => {
    if (result.status === "completed" || result.status === "failed") {
      return 0;
    }

    if (result.status === "running") {
      return 1;
    }

    return 2;
  };

  const sortedRoots = [...roots].sort((a, b) => {
    const rankDiff = rootCompletionRank(a) - rootCompletionRank(b);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const updatedDiff =
      new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const ordered: WorkbenchResult[] = [];
  const appendBranch = (result: WorkbenchResult) => {
    ordered.push(result);

    const children = sortByCreatedAt(childrenByParent.get(result.id) ?? []);
    for (const child of children) {
      appendBranch(child);
    }
  };

  for (const root of sortedRoots) {
    appendBranch(root);
  }

  return ordered;
}

function formatElapsedTime(startedAt: number, now: number, language: AppLanguage) {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (elapsedSeconds < 60) {
    return language === "ko"
      ? `${elapsedSeconds}초 경과`
      : `${elapsedSeconds}s elapsed`;
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return language === "ko"
    ? `${minutes}분 ${seconds}초 경과`
    : `${minutes}m ${seconds}s elapsed`;
}

function defaultOutputLanguageForAppLanguage(language: AppLanguage): OutputLanguage {
  return language === "ko" ? "ko" : "en";
}

function compactPreview(value: string | null | undefined, fallback: string) {
  const compact = (value || "").replace(/\s+/g, " ").trim();
  if (!compact) {
    return fallback;
  }
  return compact.length > 92 ? `${compact.slice(0, 89)}...` : compact;
}

function buildWorkLines(input: {
  language: AppLanguage;
  primary: string;
  secondary: string;
}) {
  if (input.language === "ko") {
    return [
      `\uacc4\uc0b0 \ucd08\uc810: ${input.primary}`,
      `\ucc38\uc870 \ub0b4\uc6a9: ${input.secondary}`,
    ] as [string, string];
  }

  return [
    `Working focus: ${input.primary}`,
    `Reference: ${input.secondary}`,
  ] as [string, string];
}

function activeWorkLines(
  entry: RunProgressEntry,
  elapsedMs: number,
  language: AppLanguage,
) {
  if (entry.status !== "active") {
    return entry.workLines ?? null;
  }

  const stages =
    language === "ko"
      ? [
          "\uc785\ub825\uacfc \uc9c0\uc2dc\uc0ac\ud56d\uc744 \uad6c\uc870\ud654\ud558\ub294 \uc911",
          "\ud544\uc694\ud55c \ub9e5\ub77d\uacfc \uc81c\uc57d\uc744 \ub300\uc870\ud558\ub294 \uc911",
          "\ub2f5\ubcc0 \ucd08\uc548\uc744 \uc0dd\uc131\ud558\ub294 \uc911",
          "\uacb0\uacfc\ub97c \uc810\uac80\ud558\uace0 \uc800\uc7a5 \uc900\ube44 \uc911",
        ]
      : [
          "Structuring the request and instructions",
          "Checking context and constraints",
          "Drafting the response content",
          "Reviewing and preparing to save",
        ];
  const stage = stages[Math.floor(elapsedMs / 7000) % stages.length];
  return [stage, entry.workLines?.[1] ?? entry.detail ?? ""] as [string, string];
}

type WorkbenchClientProps = {
  isTrialMode?: boolean;
};

export function WorkbenchClient({ isTrialMode = false }: WorkbenchClientProps = {}) {
  const { language, t } = useLanguage();
  const builderText = workflowBuilderText[language];
  const uiText = workbenchUiText[language];
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selections, setSelections] = useState<
    Partial<Record<ProviderName, ProviderSelection>>
  >({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [finalResultId, setFinalResultId] = useState<string | null>(null);
  const [originalInput, setOriginalInput] = useState("");
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [outputStyle, setOutputStyle] = useState("detailed");
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(() =>
    defaultOutputLanguageForAppLanguage(language),
  );
  const [mode, setMode] = useState<"parallel" | "sequential">("parallel");
  const [workflowSteps, setWorkflowSteps] =
    useState<WorkflowStepState[]>(() => initialSteps(language));
  const [workflowControl, setWorkflowControl] = useState<WorkflowControlState>(
    () => defaultWorkflowControlState(),
  );
  const [attachments, setAttachments] = useState<WorkbenchAttachment[]>([]);
  const [results, setResults] = useState<WorkbenchResult[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState(() => defaultPresetName(language));
  const [presetDescription, setPresetDescription] = useState(() =>
    defaultPresetDescription(language),
  );
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [draftBanner, setDraftBanner] = useState<{ savedAt: number } | null>(null);
  const [activeMobilePanel, setActiveMobilePanel] =
    useState<MobilePanel>("input");
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [resultLayout, setResultLayout] = useState<ResultLayout>("double");
  const [runMonitor, setRunMonitor] = useState<RunMonitor | null>(null);
  const [usage, setUsage] = useState<UsageStatusType | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [parallelComparison, setParallelComparison] =
    useState<ParallelComparisonState>({
      signature: "",
      status: "idle",
    });
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const parallelComparisonRef = useRef(parallelComparison);

  useEffect(() => {
    parallelComparisonRef.current = parallelComparison;
  }, [parallelComparison]);

  function providerLabel(providerName: ProviderName) {
    return (
      providers.find((provider) => provider.providerName === providerName)?.shortName ||
      providerName
    );
  }

  function focusProgressPanel() {
    setActiveMobilePanel("results");
    window.setTimeout(() => {
      progressSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function updateProgressEntry(input: {
    index: number;
    status?: RunProgressStatus;
    detail?: string | null;
    title?: string;
    subtitle?: string;
    workLines?: [string, string];
  }) {
    setRunMonitor((current) => {
      if (!current) {
        return current;
      }

      const entries = [...current.entries];
      const existing = entries[input.index];
      entries[input.index] = {
        key: existing?.key ?? `stream-${input.index}`,
        title: input.title || existing?.title || `${uiText.sequentialStep} ${input.index + 1}`,
        subtitle:
          input.subtitle ||
          existing?.subtitle ||
          `${current.mode === "parallel" ? uiText.parallelRun : uiText.sequentialStep} ${
            input.index + 1
          }`,
        status: input.status || existing?.status || "active",
        detail:
          input.detail === undefined
            ? existing?.detail ?? uiText.running
            : input.detail,
        workLines: input.workLines || existing?.workLines,
      };

      return { ...current, entries };
    });
  }

  function createRunMonitor(modeToRun: "parallel" | "sequential") {
    const startedAt = Date.now();
    if (modeToRun === "parallel") {
      return {
        mode: "parallel" as const,
        startedAt,
        entries: selectedTargets.map((target, index) => ({
          key: `parallel-${target.provider}-${target.model}-${index}`,
          title: `${providerLabel(target.provider as ProviderName)} / ${getModelDisplayName(
            target.provider as ProviderName,
            target.model,
          )}`,
          subtitle: `${uiText.parallelRun} ${index + 1}`,
          status: "active" as const,
          detail: uiText.preparing,
          workLines: buildWorkLines({
            language,
            primary:
              language === "ko"
                ? "\uc6d0\ubcf8 \uc9c8\ubb38\uc5d0 \ub300\ud55c \ubcd1\ub82c \ub2f5\ubcc0 \uc0dd\uc131"
                : "Generating a parallel answer for the original task",
            secondary: compactPreview(originalInput, uiText.preparing),
          }),
        })),
      };
    }

    return {
      mode: "sequential" as const,
      startedAt,
      entries: workflowSteps.map((step, index) => ({
        key: `step-${step.uid}`,
          title: `${providerLabel(step.targetProvider)} / ${getModelDisplayName(
            step.targetProvider,
            step.targetModel,
          )}`,
        subtitle: `${uiText.sequentialStep} ${step.orderIndex}`,
        status: index === 0 ? ("active" as const) : ("queued" as const),
        detail: index === 0 ? uiText.preparing : uiText.queued,
        workLines: buildWorkLines({
          language,
          primary: compactPreview(
            step.instructionTemplate,
            language === "ko"
              ? "\uc21c\ucc28 \ub2e8\uacc4 \uc9c0\uc2dc\uc0ac\ud56d \uc801\uc6a9"
              : "Applying the sequential step instruction",
          ),
          secondary: compactPreview(originalInput, uiText.preparing),
        }),
      })),
    };
  }

  function finalizeRunMonitor(input: {
    mode: "parallel" | "sequential";
    results: WorkbenchResult[];
    executionSummary?: {
      plannedTotal: number;
      executedTotal: number;
      stoppedEarly: boolean;
      stopReason?: string | null;
    };
  }) {
    setRunMonitor((current) => {
      const base = current ?? createRunMonitor(input.mode);
      const entries = base.entries.map((entry, index) => {
        const result = input.results[index];

        if (result) {
          return {
            ...entry,
            status: result.status === "failed" ? ("failed" as const) : ("completed" as const),
            detail: result.status === "failed" ? result.errorMessage || uiText.failed : uiText.completed,
          };
        }

        if (input.executionSummary?.stoppedEarly) {
          return {
            ...entry,
            status: "skipped" as const,
            detail: uiText.skipped,
          };
        }

        return entry;
      });

      return {
        ...base,
        entries,
      };
    });
  }

  function handleAuthRedirect(response: Response, data?: UsageErrorPayload) {
    if (response.status === 401 && data?.redirectUrl) {
      window.location.href = data.redirectUrl;
      return true;
    }
    return false;
  }

  function handleUsageError(data?: UsageErrorPayload) {
    if (!data?.usage) {
      return false;
    }

    setUsage(data.usage);
    writeUsageCache(data.usage);
    if (data.code === "LIMIT_REACHED") {
      setLimitModalOpen(true);
      return true;
    }

    return false;
  }

  async function loadUsageStatus() {
    const cached = readUsageCache<UsageStatusType>();
    if (cached) {
      setUsage(cached.data);
      setUsageLoading(false);
      return;
    }

    setUsageLoading(true);
    try {
      const response = await fetch("/api/usage");
      const data = (await response.json().catch(() => ({}))) as {
        usage?: UsageStatusType;
      };

      if (response.ok && data.usage) {
        setUsage(data.usage);
        writeUsageCache(data.usage);
      }
    } finally {
      setUsageLoading(false);
    }
  }

  async function loadProviders() {
    const response = await fetch("/api/providers");
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { providers: ProviderOption[] };
    setProviders(data.providers);
    setSelections((current) => {
      const next = { ...current };
      data.providers.forEach((provider) => {
        const normalized = normalizeProviderSelection(
          next[provider.providerName],
          provider,
        );
        next[provider.providerName] = {
          enabled: normalized.enabled,
          models:
            normalized.models.length || !normalized.enabled
              ? normalized.models
              : [provider.defaultModel],
        };
      });
      return next;
    });
    setWorkflowSteps((steps) => normalizeStepsForProviders(steps, data.providers));
  }

  function applyPreset(preset: Preset) {
    const parsed = JSON.parse(preset.workflowJson) as Record<string, unknown>;
    const parsedSteps = (parsed.steps as Omit<WorkflowStepState, "uid">[] | undefined)?.slice(
      0,
      MAX_TEMPLATE_STEPS,
    );

    if (parsedSteps?.length) {
      const nextSteps = normalizeStepsForProviders(
        parsedSteps.map((step) => ({
          ...step,
          uid: newUid(),
        })),
        providers,
      );
      setWorkflowSteps(nextSteps);
      setWorkflowControl(workflowControlFromPreset(parsed, parsedSteps.length));
      setMode("sequential");
      setNotice(`${t("loadPreset")}: ${preset.name}`);
    }
  }

  async function loadPresets(presetToLoad?: string | null) {
    const response = await fetch("/api/presets");
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { presets: Preset[] };
    setPresets(data.presets);

    if (presetToLoad) {
      const preset = data.presets.find((item) => item.id === presetToLoad);
      if (preset) {
        applyPreset(preset);
      }
    }
  }

  async function loadProject(id: string) {
    const response = await fetch(`/api/projects/${id}`);
    const data = (await response.json().catch(() => ({}))) as {
      project?: ProjectMeta;
      error?: string;
    };

    if (!response.ok || !data.project) {
      setError(language === "ko" ? t("runFailed") : data.error || t("runFailed"));
      return;
    }

    setProject({
      id: data.project.id,
      name: data.project.name,
      description: data.project.description,
      sharedContext: data.project.sharedContext,
    });
    setRunMonitor(null);
    setNotice(`${t("projectContextLoaded")} ${data.project.name}`);
  }

  function applySessionToState(session: LoadedSession) {
    setSessionId(session.id);
    setProject(
      session.project
        ? {
            id: session.project.id,
            name: session.project.name,
            description: session.project.description ?? null,
            sharedContext: session.project.sharedContext,
          }
        : null,
    );
    setSessionTitle(session.title);
    setOriginalInput(session.originalInput);
    setAdditionalInstruction(session.additionalInstruction || "");
    setOutputStyle(session.outputStyle || "detailed");
    setOutputLanguage(
      outputLanguages.includes(session.outputLanguage as OutputLanguage)
        ? (session.outputLanguage as OutputLanguage)
        : defaultOutputLanguageForAppLanguage(language),
    );
    setMode(session.mode === "sequential" ? "sequential" : "parallel");
    setFinalResultId(session.finalResultId);
    setAttachments(session.attachments || []);
    setResults(session.results);
    setRunMonitor(null);
    if (session.workflowSteps.length) {
      setWorkflowSteps(
        normalizeStepsForProviders(
          session.workflowSteps.map((step) => ({
            uid: step.id || newUid(),
            orderIndex: step.orderIndex,
            actionType: step.actionType,
            targetProvider: step.targetProvider,
            targetModel: step.targetModel,
            sourceMode: step.sourceMode,
            sourceResultId: step.sourceResultId,
            instructionTemplate: step.instructionTemplate,
          })),
          providers,
        ),
      );
    }
    setWorkflowControl(
      normalizeWorkflowControlState(
        defaultWorkflowControlState(),
        session.workflowSteps.length || initialSteps(language).length,
      ),
    );
  }

  async function loadSession(id: string) {
    setError("");

    // ── Cache-first: render immediately from localStorage if available ──
    const cached = readSessionCache<LoadedSession>(id);
    if (cached) {
      applySessionToState(cached.data);
      setNotice(`${t("sessionLoaded")} ${cached.data.title}`);

      // Background server sync — updates state and cache if data changed
      fetch(`/api/sessions/${id}`)
        .then((r) => r.json())
        .then((data: { session?: LoadedSession }) => {
          if (data.session) {
            applySessionToState(data.session);
            writeSessionCache(id, data.session);
          }
        })
        .catch(() => {});
      return;
    }

    // ── No cache: normal server fetch ──
    const response = await fetch(`/api/sessions/${id}`);
    const data = (await response.json().catch(() => ({}))) as {
      session?: LoadedSession;
      error?: string;
    };

    if (!response.ok || !data.session) {
      setError(language === "ko" ? t("runFailed") : data.error || t("runFailed"));
      return;
    }

    applySessionToState(data.session);
    writeSessionCache(id, data.session);
    setNotice(`${t("sessionLoaded")} ${data.session.title}`);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("session");
    const presetId = params.get("preset");
    const projectId = params.get("project");

    loadProviders();
    loadUsageStatus();
    loadPresets(presetId);
    if (loadId) {
      loadSession(loadId);
    } else if (projectId) {
      loadProject(projectId);
    } else {
      // No URL session — try to restore unsaved draft from localStorage
      const draft = loadDraft();
      if (draft && draft.originalInput.trim()) {
        setOriginalInput(draft.originalInput);
        setAdditionalInstruction(draft.additionalInstruction);
        setOutputStyle(draft.outputStyle);
        setOutputLanguage(
          outputLanguages.includes(draft.outputLanguage as OutputLanguage)
            ? (draft.outputLanguage as OutputLanguage)
            : defaultOutputLanguageForAppLanguage(language),
        );
        setMode(draft.mode);
        setAttachments(draft.attachments || []);
        setWorkflowSteps(
          sortSteps(
            draft.workflowSteps.map((s) => ({
              ...s,
              uid: s.uid || newUid(),
              actionType: s.actionType as ActionType,
              targetProvider: s.targetProvider as ProviderName,
              sourceMode: s.sourceMode as WorkflowStepState["sourceMode"],
            })),
          ),
        );
        setDraftBanner({ savedAt: draft.savedAt });
      }
    }
    // Load URL-provided session or preset once on initial entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("qkiki-result-layout-v2");
    if (stored === "double" || stored === "single") {
      setResultLayout(stored);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("qkiki-result-layout-v2", resultLayout);
  }, [resultLayout]);

  useEffect(() => {
    if (!runMonitor || !runMonitor.entries.some((entry) => entry.status === "active")) {
      return;
    }

    const timer = window.setInterval(() => {
      setProgressNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [runMonitor]);

  useEffect(() => {
    if (mode === "parallel" && activeMobilePanel === "workflow") {
      setActiveMobilePanel("input");
    }

    if (mode !== "parallel") {
      setParallelComparison({ signature: "", status: "idle" });
    }
  }, [activeMobilePanel, mode]);

  useEffect(() => {
    if (mode !== "parallel" || !sessionId) {
      return;
    }

    const latestByProviderModel = new Map<string, WorkbenchResult>();

    results
      .filter(
        (result) =>
          result.parentResultId === null &&
          result.status === "completed" &&
          Boolean(result.outputText?.trim()),
      )
      .forEach((result) => {
        const key = `${result.provider}:${result.model}`;
        const current = latestByProviderModel.get(key);

        if (
          !current ||
          new Date(result.createdAt).getTime() >=
            new Date(current.createdAt).getTime()
        ) {
          latestByProviderModel.set(key, result);
        }
      });

    const candidates = Array.from(latestByProviderModel.values()).sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
    const signature = candidates.map((result) => result.id).join("|");

    if (running || candidates.length < 2) {
      if (
        candidates.length < 2 &&
        !(
          parallelComparisonRef.current.status === "idle" &&
          parallelComparisonRef.current.signature === signature
        )
      ) {
        setParallelComparison({
          signature,
          status: "idle",
        });
      }
      return;
    }

    if (
      parallelComparisonRef.current.signature === signature &&
      parallelComparisonRef.current.status !== "idle"
    ) {
      return;
    }

    const controller = new AbortController();

    setParallelComparison({
      signature,
      status: "loading",
    });

    fetch("/api/workbench/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        resultIds: candidates.map((result) => result.id),
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          comparison?: ParallelComparisonSummary;
          error?: string;
        };

        if (!response.ok || !data.comparison) {
          throw new Error(data.error || uiText.compareFailed);
        }

        if (!controller.signal.aborted) {
          setParallelComparison({
            signature,
            status: "completed",
            comparison: data.comparison,
          });
        }
      })
      .catch((compareError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setParallelComparison({
          signature,
          status: "failed",
          error:
            compareError instanceof Error
              ? compareError.message
              : uiText.compareFailed,
        });
      });

    return () => controller.abort();
  }, [
    mode,
    results,
    running,
    sessionId,
    uiText.compareFailed,
  ]);

  // ── Draft autosave: debounced 2 s, only when no server session exists ──
  useEffect(() => {
    if (sessionId) return; // already saved server-side — no draft needed
    if (!originalInput.trim()) return; // nothing meaningful to save yet

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      saveDraft({
        originalInput,
        additionalInstruction,
        outputStyle,
        outputLanguage,
        mode,
        attachments,
        workflowSteps,
      });
    }, 2000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    sessionId,
    originalInput,
    additionalInstruction,
    outputStyle,
    outputLanguage,
    mode,
    attachments,
    workflowSteps,
  ]);

  useEffect(() => {
    if (!sessionId && !results.length && !originalInput.trim()) {
      const nextSteps = initialSteps(language);
      setWorkflowSteps(nextSteps);
      setWorkflowControl(
        normalizeWorkflowControlState(
          defaultWorkflowControlState(),
          nextSteps.length,
        ),
      );
    }
    setPresetName((current) =>
      current === defaultPresetName("en") || current === defaultPresetName("ko")
        ? defaultPresetName(language)
        : current,
    );
    setPresetDescription((current) =>
      current === defaultPresetDescription("en") ||
      current === defaultPresetDescription("ko")
        ? defaultPresetDescription(language)
        : current,
    );
  }, [language, originalInput, results.length, sessionId]);

  useEffect(() => {
    setWorkflowControl((current) =>
      normalizeWorkflowControlState(current, workflowSteps.length),
    );
  }, [workflowSteps.length]);

  const resultLabels = useMemo(
    () =>
      results.map((result, index) => ({
        id: result.id,
        label: `${index + 1}. ${result.provider}/${getModelDisplayName(
          result.provider,
          result.model,
        )}`,
      })),
    [results],
  );

  const selectedTargets = useMemo<TargetModelInput[]>(() => {
    return providers.flatMap((provider) => {
      const selection = normalizeProviderSelection(
        selections[provider.providerName],
        provider,
      );

      if (!selection.enabled || !selection.models.length) {
        return [];
      }

      return selection.models.map((model) => ({
        provider: provider.providerName,
        model,
      }));
    });
  }, [providers, selections]);

  const normalizedWorkflowControl = useMemo(
    () => normalizeWorkflowControlState(workflowControl, workflowSteps.length),
    [workflowControl, workflowSteps.length],
  );

  const estimatedSequentialExecutions = useMemo(
    () =>
      calculateSequentialExecutionCount(
        workflowSteps.length,
        normalizedWorkflowControl,
      ),
    [normalizedWorkflowControl, workflowSteps.length],
  );

  const exceedsSequentialLimit =
    estimatedSequentialExecutions > MAX_TOTAL_SEQUENTIAL_EXECUTIONS;

  const resultDepths = useMemo(() => {
    const byId = new Map(results.map((result) => [result.id, result]));
    const depthMap = new Map<string, number>();
    const depthOf = (result: WorkbenchResult): number => {
      if (depthMap.has(result.id)) {
        return depthMap.get(result.id) ?? 0;
      }
      const parent = result.parentResultId ? byId.get(result.parentResultId) : null;
      const depth = parent ? depthOf(parent) + 1 : 0;
      depthMap.set(result.id, depth);
      return depth;
    };
    results.forEach(depthOf);
    return depthMap;
  }, [results]);

  const displayResults = useMemo(
    () => sortResultsForDisplay(results, mode),
    [mode, results],
  );

  const parallelComparisonCandidates = useMemo(() => {
    if (mode !== "parallel") {
      return [] as WorkbenchResult[];
    }

    const latestByProviderModel = new Map<string, WorkbenchResult>();

    results
      .filter(
        (result) =>
          result.parentResultId === null &&
          result.status === "completed" &&
          Boolean(result.outputText?.trim()),
      )
      .forEach((result) => {
        const key = `${result.provider}:${result.model}`;
        const current = latestByProviderModel.get(key);

        if (
          !current ||
          new Date(result.createdAt).getTime() >=
            new Date(current.createdAt).getTime()
        ) {
          latestByProviderModel.set(key, result);
        }
      });

    return Array.from(latestByProviderModel.values()).sort(
      (left, right) =>
        new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime(),
    );
  }, [mode, results]);

  const resultStats = useMemo(
    () => ({
      total: results.length,
      completed: results.filter((result) => result.status === "completed").length,
      failed: results.filter((result) => result.status === "failed").length,
      running:
        results.filter((result) => result.status === "running").length ||
        runMonitor?.entries.filter((entry) => entry.status === "active").length ||
        0,
      finalLabel:
        results.find((result) => result.id === finalResultId)?.provider ??
        uiText.finalPending,
    }),
    [finalResultId, results, runMonitor, uiText.finalPending],
  );

  const progressEntries = useMemo(() => {
    if (!runMonitor) {
      return [];
    }

    const elapsed = progressNow - runMonitor.startedAt;
    return runMonitor.entries.map((entry) => {
      const workLines = activeWorkLines(entry, elapsed, language);
      if (entry.status !== "active") {
        return { ...entry, workLines: workLines ?? entry.workLines };
      }

      const detail =
        elapsed < 2500
          ? uiText.preparing
          : elapsed < 12000
            ? uiText.running
            : uiText.wrapping;

      return {
        ...entry,
        detail,
        workLines: workLines ?? entry.workLines,
      };
    });
  }, [language, progressNow, runMonitor, uiText.preparing, uiText.running, uiText.wrapping]);

  function updateStep(updated: WorkflowStepState) {
    setWorkflowSteps((steps) =>
      sortSteps(steps.map((step) => (step.uid === updated.uid ? updated : step))),
    );
  }

  function addStep() {
    if (workflowSteps.length >= MAX_TEMPLATE_STEPS) {
      setError(builderText.addStepLimit);
      return;
    }
    const last = workflowSteps[workflowSteps.length - 1];
    const provider = providers[0];
    setWorkflowSteps(
      sortSteps([
        ...workflowSteps,
        {
          uid: newUid(),
          orderIndex: workflowSteps.length + 1,
          actionType: "improve",
          targetProvider: provider?.providerName ?? last?.targetProvider ?? "openai",
          targetModel:
            provider?.defaultModel ?? last?.targetModel ?? "gpt-5.4-mini",
          sourceMode: "previous",
          instructionTemplate:
            language === "ko"
              ? "\uc774\uc804 \ub2e8\uacc4\ub97c \uac1c\uc120\ud558\uc138\uc694."
              : "Improve the previous step.",
        },
      ]),
    );
  }

  function deleteStep(uid: string) {
    if (workflowSteps.length <= 1) {
      setError(builderText.minimumStepNotice);
      return;
    }

    setWorkflowSteps((steps) =>
      sortSteps(steps.filter((step) => step.uid !== uid)),
    );
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    if (attachments.length + fileList.length > MAX_ATTACHMENTS_PER_RUN) {
      setError(
        language === "ko"
          ? `파일은 최대 ${MAX_ATTACHMENTS_PER_RUN}개까지 첨부할 수 있습니다.`
          : `You can attach up to ${MAX_ATTACHMENTS_PER_RUN} files.`,
      );
      return;
    }

    setError("");
    setUploadingAttachments(true);

    try {
      const uploaded = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const formData = new FormData();
          formData.set("file", file);
          if (sessionId) {
            formData.set("sessionId", sessionId);
          }

          const response = await fetch("/api/attachments", {
            method: "POST",
            body: formData,
          });
          const data = (await response.json().catch(() => ({}))) as {
            attachment?: WorkbenchAttachment;
            error?: string;
          };

          if (!response.ok || !data.attachment) {
            throw new Error(data.error || t("runFailed"));
          }

          return data.attachment;
        }),
      );

      setAttachments((current) => mergeAttachments(current, uploaded));
      setNotice(
        language === "ko"
          ? `${uploaded.length}개 파일을 첨부했습니다.`
          : `Attached ${uploaded.length} file(s).`,
      );
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : t("runFailed"),
      );
    } finally {
      setUploadingAttachments(false);
    }
  }

  async function removeAttachment(id: string) {
    setError("");
    const response = await fetch(`/api/attachments/${id}`, {
      method: "DELETE",
    });
    const data = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok) {
      setError(data.error || t("deleteFailed"));
      return;
    }

    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  async function readRunStream(response: Response) {
    if (!response.body) {
      return null;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let donePayload: Extract<WorkbenchRunStreamEvent, { type: "done" }> | null = null;
    let streamError = "";

    const handleEvent = (event: WorkbenchRunStreamEvent) => {
      if (event.type === "session") {
        setSessionId(event.session.id);
        setSessionTitle(event.session.title);
        setFinalResultId(event.session.finalResultId || null);
        return;
      }

      if (event.type === "progress") {
        updateProgressEntry({
          index: event.index,
          status: event.status || "active",
          title: event.title,
          subtitle: event.subtitle,
          detail: event.detail || uiText.running,
          workLines: buildWorkLines({
            language,
            primary: event.detail || uiText.running,
            secondary: compactPreview(originalInput, uiText.preparing),
          }),
        });
        return;
      }

      if (event.type === "result") {
        setResults((current) => mergeResults(current, [event.result]));
        updateProgressEntry({
          index: event.index,
          status: event.result.status === "failed" ? "failed" : "completed",
          detail:
            event.result.status === "failed"
              ? event.result.errorMessage || uiText.failed
              : uiText.completed,
          workLines: buildWorkLines({
            language,
            primary:
              event.result.status === "failed"
                ? uiText.failed
                : uiText.completed,
            secondary: compactPreview(
              event.result.outputText || event.result.errorMessage,
              event.result.provider,
            ),
          }),
        });
        return;
      }

      if (event.type === "usage") {
        setUsage(event.usage);
        writeUsageCache(event.usage);
        return;
      }

      if (event.type === "done") {
        donePayload = event;
        if (event.session) {
          setSessionId(event.session.id);
          setSessionTitle(event.session.title);
          setFinalResultId(event.session.finalResultId || null);
        }
        if (event.usage) {
          setUsage(event.usage);
          writeUsageCache(event.usage);
        }
        return;
      }

      if (event.type === "error") {
        if (event.redirectUrl) {
          window.location.href = event.redirectUrl;
          return;
        }
        if (event.usage) {
          setUsage(event.usage);
          writeUsageCache(event.usage);
        }
        streamError = event.error || t("runFailed");
        setRunMonitor((current) =>
          current
            ? {
                ...current,
                entries: current.entries.map((entry) =>
                  entry.status === "active"
                    ? { ...entry, status: "failed", detail: streamError }
                    : entry,
                ),
              }
            : current,
        );
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        handleEvent(JSON.parse(line) as WorkbenchRunStreamEvent);
      }

      if (done) {
        break;
      }
    }

    if (buffer.trim()) {
      handleEvent(JSON.parse(buffer) as WorkbenchRunStreamEvent);
    }

    if (streamError) {
      throw new Error(streamError);
    }

    return donePayload;
  }

  async function runWorkbench() {
    setError("");
    setNotice("");

    if (!originalInput.trim()) {
      setError(t("taskRequired"));
      return;
    }

    if (mode === "parallel" && !selectedTargets.length) {
      setError(t("enableProviderShort"));
      return;
    }

    if (mode === "sequential" && !workflowSteps.length) {
      setError(builderText.minimumStepNotice);
      return;
    }

    if (mode === "sequential" && exceedsSequentialLimit) {
      setError(builderText.totalLimitNotice);
      return;
    }

    if (uploadingAttachments) {
      setError(t("uploading"));
      return;
    }

    setProgressNow(Date.now());
    setRunMonitor(createRunMonitor(mode));
    focusProgressPanel();
    if (mode === "parallel") {
      setParallelComparison({ signature: "", status: "idle" });
    }
    setRunning(true);
    const body = {
      sessionId,
      projectId: project?.id ?? null,
      title: sessionTitle || null,
      originalInput,
      additionalInstruction,
      outputStyle,
      outputLanguage,
      attachmentIds: attachments.map((attachment) => attachment.id),
      mode,
      targets: mode === "parallel" ? selectedTargets : undefined,
      steps:
        mode === "sequential"
          ? workflowSteps.map((step) => ({
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
        mode === "sequential"
          ? {
              repeat: {
                enabled: normalizedWorkflowControl.repeatEnabled,
                startStepOrder: normalizedWorkflowControl.repeatStartStep,
                endStepOrder: normalizedWorkflowControl.repeatEndStep,
                repeatCount: normalizedWorkflowControl.repeatCount,
              },
              stopCondition: {
                enabled: normalizedWorkflowControl.stopConditionEnabled,
                checkStepOrder: normalizedWorkflowControl.stopConditionStep,
                qualityThreshold: normalizedWorkflowControl.qualityThreshold,
              },
            }
          : undefined,
    };
    let data: ({
      session?: { id: string; title: string; finalResultId?: string | null };
      results?: WorkbenchResult[];
      executionSummary?: {
        plannedTotal: number;
        executedTotal: number;
        stoppedEarly: boolean;
        stopReason?: string | null;
      };
      usage?: UsageStatusType;
    } & UsageErrorPayload) = {};

    try {
      const response = await fetch("/api/workbench/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify(body),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/x-ndjson")) {
        const streamed = await readRunStream(response);
        data = streamed || {};
      } else {
        data = (await response.json().catch(() => ({}))) as typeof data;
      }

      if (handleAuthRedirect(response, data)) {
        return;
      }

      if (handleUsageError(data)) {
        setError(data.error || t("runFailed"));
        return;
      }

      if (!response.ok || !data.session) {
        setRunMonitor((current) =>
          current
            ? {
                ...current,
                entries: current.entries.map((entry) => ({
                  ...entry,
                  status: "failed",
                  detail: data.error || uiText.failed,
                })),
              }
            : current,
        );
        setError(data.error || t("runFailed"));
        return;
      }

      setSessionId(data.session.id);
      setSessionTitle(data.session.title);
      setFinalResultId(data.session.finalResultId || null);
      if (data.usage) {
        setUsage(data.usage);
        writeUsageCache(data.usage);
      }
      setResults((current) => mergeResults(current, data.results || []));
      setActiveMobilePanel("results");
      clearDraft();
      setDraftBanner(null);
      finalizeRunMonitor({
        mode,
        results: data.results || [],
        executionSummary: data.executionSummary,
      });
      const completionNotice =
        data.results?.some((result) => result.status === "failed")
          ? t("runCompletedPartial")
          : t("runCompleted");
      if (mode === "sequential" && data.executionSummary?.stoppedEarly) {
        setNotice(
          `${completionNotice} (${data.executionSummary.executedTotal}/${data.executionSummary.plannedTotal})`,
        );
        return;
      }
      setNotice(completionNotice);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : t("runFailed"));
    } finally {
      setRunning(false);
    }
  }

  async function runBranch(input: {
    parentResultId: string;
    actionType: ActionType;
    instruction: string;
    targets: TargetModelInput[];
  }) {
    setError("");
    setNotice("");
    const response = await fetch("/api/workbench/branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, outputLanguage }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      results?: WorkbenchResult[];
      usage?: UsageStatusType;
    } & UsageErrorPayload;

    if (handleAuthRedirect(response, data)) {
      return;
    }

    if (handleUsageError(data)) {
      setError(data.error || t("branchRunFailed"));
      return;
    }

    if (!response.ok) {
      setError(
        language === "ko"
          ? t("branchRunFailed")
          : data.error || t("branchRunFailed"),
      );
      return;
    }

    if (data.usage) {
      setUsage(data.usage);
      writeUsageCache(data.usage);
    }
    setResults((current) => mergeResults(current, data.results || []));
    setActiveMobilePanel("results");
    setNotice(t("branchAdded"));
  }

  async function rerunResult(resultId: string) {
    setError("");
    const response = await fetch(`/api/results/${resultId}/rerun`, {
      method: "POST",
    });
    const data = (await response.json().catch(() => ({}))) as {
      result?: WorkbenchResult;
      usage?: UsageStatusType;
    } & UsageErrorPayload;

    if (handleAuthRedirect(response, data)) {
      return;
    }

    if (handleUsageError(data)) {
      setError(data.error || t("rerunFailed"));
      return;
    }

    if (!response.ok || !data.result) {
      setError(
        data.error || t("rerunFailed"),
      );
      return;
    }

    const rerun = data.result;
    if (data.usage) {
      setUsage(data.usage);
      writeUsageCache(data.usage);
    }
    setResults((current) => mergeResults(current, [rerun]));
    setActiveMobilePanel("results");
    setNotice(t("rerunAdded"));
  }

  async function markFinal(resultId: string) {
    const response = await fetch(`/api/results/${resultId}/mark-final`, {
      method: "POST",
    });
    if (response.ok) {
      setFinalResultId(resultId);
      setNotice(t("finalMarked"));
    }
  }

  async function deleteBranch(resultId: string) {
    if (!window.confirm(t("deleteBranchConfirm"))) {
      return;
    }
    const response = await fetch(`/api/results/${resultId}`, {
      method: "DELETE",
    });
    const data = (await response.json().catch(() => ({}))) as {
      deletedIds?: string[];
      error?: string;
    };

    if (!response.ok) {
      setError(
        language === "ko" ? t("deleteFailed") : data.error || t("deleteFailed"),
      );
      return;
    }

    setResults((current) =>
      current.filter((result) => !data.deletedIds?.includes(result.id)),
    );
    if (data.deletedIds?.includes(finalResultId || "")) {
      setFinalResultId(null);
    }
    setNotice(t("branchDeleted"));
  }

  async function savePreset() {
    const workflowJson = JSON.stringify({
      steps: workflowSteps.map((step) => ({
        orderIndex: step.orderIndex,
        actionType: step.actionType,
        targetProvider: step.targetProvider,
        targetModel: step.targetModel,
        sourceMode: step.sourceMode,
        sourceResultId: step.sourceResultId,
        instructionTemplate: step.instructionTemplate,
      })),
      workflowControl: {
        repeat: {
          enabled: normalizedWorkflowControl.repeatEnabled,
          startStepOrder: normalizedWorkflowControl.repeatStartStep,
          endStepOrder: normalizedWorkflowControl.repeatEndStep,
          repeatCount: normalizedWorkflowControl.repeatCount,
        },
        stopCondition: {
          enabled: normalizedWorkflowControl.stopConditionEnabled,
          checkStepOrder: normalizedWorkflowControl.stopConditionStep,
          qualityThreshold: normalizedWorkflowControl.qualityThreshold,
        },
      },
    });
    const response = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: presetName,
        description: presetDescription,
        workflowJson,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      preset?: Preset;
      error?: string;
    };

    if (!response.ok || !data.preset) {
      setError(language === "ko" ? t("runFailed") : data.error || t("runFailed"));
      return;
    }

    const savedPreset = data.preset;
    setPresets((current) => [savedPreset, ...current]);
    setNotice(t("workflowPresetSaved"));
  }

  function loadPreset(id: string) {
    const preset = presets.find((item) => item.id === id);
    if (!preset) {
      return;
    }
    applyPreset(preset);
  }

  const mobilePanels: Array<{ id: MobilePanel; label: string }> = [
    { id: "models", label: t("mobileModels") },
    { id: "input", label: t("mobileInput") },
    {
      id: "results",
      label: results.length
        ? `${t("mobileResults")} (${results.length})`
        : t("mobileResults"),
    },
  ];

  if (mode === "sequential") {
    mobilePanels.splice(2, 0, {
      id: "workflow",
      label: t("mobileWorkflow"),
    });
  }

  const mobilePanelClass = (panel: MobilePanel) =>
    activeMobilePanel === panel ? "block" : "hidden xl:block";

  const middlePanelClass =
    activeMobilePanel === "input" || activeMobilePanel === "workflow"
      ? "block"
      : "hidden xl:block";

  return (
    <div className="space-y-5">
      <LimitReachedModal
        usage={usage}
        open={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
      />

      {isTrialMode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <span className="text-sm font-semibold text-blue-700">✨</span>
            </div>
            <div>
              <p className="font-semibold text-blue-950">
                {language === "ko" ? "체험 모드" : "Trial Mode"}
              </p>
              <p className="text-sm text-blue-800">
                {language === "ko"
                  ? "로그인 없이 5번까지 구독자와 동일하게 사용할 수 있습니다. 6번째부터는 로그인 후 계속 이용할 수 있습니다."
                  : "Use the full workbench for 5 conversations without signing in. Starting from the 6th, sign in to continue."}
              </p>
            </div>
          </div>
        </div>
      )}

      <SectionHeader
        eyebrow={t("workbench")}
        title={t("compareBranchRoute")}
        description={t("workbenchDescription")}
      />

      {usage && !isTrialMode ? <UsageStatus usage={usage} compact /> : null}
      {usageLoading && !isTrialMode ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500 shadow-sm">
          {language === "ko" ? "사용량 정보를 불러오는 중..." : "Loading usage status..."}
        </div>
      ) : null}

      {project ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                {t("projectLinked")}
              </p>
              <h2 className="mt-1 text-base font-semibold text-teal-950">
                {project.name}
              </h2>
              <p className="mt-1 text-sm leading-6 text-teal-900">
                {t("projectContextNote")}
              </p>
            </div>
            <Link
              href={`/app/projects/${project.id}`}
              className="rounded-md border border-teal-300 bg-white px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
            >
              {t("openProject")}
            </Link>
          </div>
        </div>
      ) : null}

      {draftBanner ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {draftText[language].restored}
            {" - "}
            <span className="hidden">
            {" · "}
            </span>
            {new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(draftBanner.savedAt))}
          </span>
          <button
            type="button"
            onClick={() => {
              clearDraft();
              setDraftBanner(null);
            }}
            className="text-left text-xs underline hover:no-underline sm:ml-4"
          >
            {draftText[language].dismiss}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="sticky top-[73px] z-30 -mx-4 bg-[#f7f8f3]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 xl:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {mobilePanels.map((panel) => {
            const active = activeMobilePanel === panel.id;
            return (
              <button
                key={panel.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveMobilePanel(panel.id)}
                className={`min-h-10 shrink-0 rounded-md px-3 py-2 text-sm font-semibold ${
                  active
                    ? "bg-stone-950 text-white"
                    : "border border-stone-200 bg-white text-stone-700"
                }`}
              >
                {panel.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`space-y-3 ${mobilePanelClass("models")}`}>
          <div className="rounded-lg border border-stone-200 bg-[#fbfcf8] p-4">
            <h2 className="text-sm font-semibold text-stone-950">
              {t("modelSelection")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              {t("enableProviderShort")}
            </p>
            <div className="mt-4 space-y-3">
              {providers.map((provider) => {
                const selection = normalizeProviderSelection(
                  selections[provider.providerName],
                  provider,
                );

                return (
                  <ProviderSelectorRow
                    key={provider.providerName}
                    provider={provider}
                    enabled={selection.enabled}
                    selectedModels={selection.models}
                    onEnabledChange={(enabled) =>
                      setSelections({
                        ...selections,
                        [provider.providerName]: {
                          enabled,
                          models:
                            enabled && !selection.models.length
                              ? [provider.defaultModel]
                              : selection.models,
                        },
                      })
                    }
                    onSelectedModelsChange={(models) =>
                      setSelections({
                        ...selections,
                        [provider.providerName]: {
                          enabled: models.length > 0,
                          models: dedupeModels(models),
                        },
                      })
                    }
                  />
                );
              })}
            </div>
          </div>
        </aside>

        <section className={`min-w-0 space-y-5 ${middlePanelClass}`}>
          <div
            className={`rounded-lg border border-stone-200 bg-white p-4 shadow-sm ${mobilePanelClass(
              "input",
            )}`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-950">
                  {t("startPoint")}
                </h2>
                <p className="text-sm text-stone-600">
                  {t("startPointDescription")}
                </p>
              </div>
              <select
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as "parallel" | "sequential")
                }
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 sm:w-auto"
              >
                <option value="parallel">{t("parallelCompare")}</option>
                <option value="sequential">{t("sequentialReviewChain")}</option>
              </select>
            </div>

            <textarea
              value={originalInput}
              onChange={(event) => setOriginalInput(event.target.value)}
              rows={6}
              className="mt-4 w-full rounded-md border border-stone-300 bg-[#fbfcf8] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600"
              placeholder={t("taskTextareaPlaceholder")}
            />
            <textarea
              value={additionalInstruction}
              onChange={(event) => setAdditionalInstruction(event.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600"
              placeholder={t("additionalInstructionPlaceholder")}
            />

            <div className="mt-3 rounded-md border border-dashed border-stone-300 bg-[#fbfcf8] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {t("attachments")}
                  </p>
                  <p className="text-xs leading-5 text-stone-600">
                    {t("attachmentsDescription")}
                  </p>
                </div>
                <label className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                  <input
                    type="file"
                    multiple
                    accept={ATTACHMENT_ACCEPT}
                    onChange={(event) => {
                      uploadFiles(event.target.files);
                      event.currentTarget.value = "";
                    }}
                    className="sr-only"
                  />
                  {uploadingAttachments ? t("uploading") : t("attachFiles")}
                </label>
              </div>

              {attachments.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex min-w-0 items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
                    >
                      <span className="rounded bg-stone-100 px-2 py-1 font-semibold text-stone-600">
                        {attachmentKindLabel(attachment.kind, language)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-stone-900">
                          {attachment.name}
                        </p>
                        <p className="text-stone-500">
                          {formatFileSize(attachment.sizeBytes, language)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(attachment.id)}
                        className="rounded border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-500 hover:bg-stone-50"
                      >
                        {t("remove")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-stone-500">{t("noAttachments")}</p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
              <label className="flex flex-col gap-1 text-sm text-stone-600">
                <span>{t("outputStyle")}</span>
                <select
                  value={outputStyle}
                  onChange={(event) => setOutputStyle(event.target.value)}
                  className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
                >
                  {outputStyles.map((style) => (
                    <option key={style} value={style}>
                      {outputStyleLabels[style]?.[language] ?? style}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-stone-600">
                <span>
                  {language === "ko"
                    ? "\uae30\ubcf8 \ucd9c\ub825 \uc5b8\uc5b4"
                    : "Default output language"}
                </span>
                <select
                  value={outputLanguage}
                  onChange={(event) =>
                    setOutputLanguage(event.target.value as OutputLanguage)
                  }
                  className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
                >
                  {outputLanguages.map((option) => (
                    <option key={option} value={option}>
                      {outputLanguageLabels[option]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={runWorkbench}
                disabled={running || uploadingAttachments}
                className="w-full rounded-md bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60 sm:w-auto"
              >
                {running ? t("running") : t("run")}
              </button>
            </div>
          </div>

          {mode === "sequential" ? (
            <div
              className={`rounded-lg border border-stone-200 bg-[#fbfcf8] p-4 ${mobilePanelClass(
                "workflow",
              )}`}
            >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-950">
                  {t("workflowBuilder")}
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  {t("workflowBuilderDescription")}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  defaultValue=""
                  onChange={(event) => {
                    loadPreset(event.target.value);
                    event.currentTarget.value = "";
                  }}
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                >
                  <option value="">{t("loadPreset")}</option>
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {workflowSteps.map((step) => (
                <WorkflowStepRow
                  key={step.uid}
                  step={step}
                  providers={providers}
                  resultOptions={resultLabels}
                  onChange={updateStep}
                  onDelete={() => deleteStep(step.uid)}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={addStep}
                disabled={workflowSteps.length >= MAX_TEMPLATE_STEPS}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                {t("addStep")}
              </button>
              <p className="text-xs text-stone-500">
                {workflowSteps.length}/{MAX_TEMPLATE_STEPS}
              </p>
            </div>

            {workflowSteps.length >= MAX_TEMPLATE_STEPS ? (
              <p className="mt-2 text-xs text-rose-700">{builderText.addStepLimit}</p>
            ) : null}

            {mode === "sequential" ? (
              <div className="mt-4 space-y-3 rounded-lg border border-stone-200 bg-white p-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {builderText.repeatSettings}
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    {builderText.estimatedTotal}: {estimatedSequentialExecutions}/
                    {MAX_TOTAL_SEQUENTIAL_EXECUTIONS}
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={normalizedWorkflowControl.repeatEnabled}
                    onChange={(event) =>
                      setWorkflowControl((current) => ({
                        ...current,
                        repeatEnabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>{builderText.repeatedBlock}</span>
                </label>

                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                  <label className="block">
                    <span className="text-xs font-medium text-stone-500">
                      {builderText.repeatRange} - {builderText.repeatStart}
                    </span>
                    <select
                      value={normalizedWorkflowControl.repeatStartStep}
                      disabled={!normalizedWorkflowControl.repeatEnabled}
                      onChange={(event) =>
                        setWorkflowControl((current) => ({
                          ...current,
                          repeatStartStep: Number(event.target.value),
                          repeatEndStep: Math.max(
                            Number(event.target.value),
                            current.repeatEndStep,
                          ),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-stone-100"
                    >
                      {workflowSteps.map((step) => (
                        <option key={`repeat-start-${step.uid}`} value={step.orderIndex}>
                          {t("step")} {step.orderIndex}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-stone-500">
                      {builderText.repeatRange} - {builderText.repeatEnd}
                    </span>
                    <select
                      value={normalizedWorkflowControl.repeatEndStep}
                      disabled={!normalizedWorkflowControl.repeatEnabled}
                      onChange={(event) =>
                        setWorkflowControl((current) => ({
                          ...current,
                          repeatEndStep: Number(event.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-stone-100"
                    >
                      {workflowSteps
                        .filter(
                          (step) =>
                            step.orderIndex >=
                            normalizedWorkflowControl.repeatStartStep,
                        )
                        .map((step) => (
                          <option key={`repeat-end-${step.uid}`} value={step.orderIndex}>
                            {t("step")} {step.orderIndex}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-medium text-stone-500">
                      {builderText.repeatCount}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={normalizedWorkflowControl.repeatCount}
                      disabled={!normalizedWorkflowControl.repeatEnabled}
                      onChange={(event) =>
                        setWorkflowControl((current) => ({
                          ...current,
                          repeatCount: Number(event.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-stone-100"
                    />
                  </label>
                </div>

                <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={normalizedWorkflowControl.stopConditionEnabled}
                      onChange={(event) =>
                        setWorkflowControl((current) => ({
                          ...current,
                          stopConditionEnabled: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-stone-300 text-teal-700 focus:ring-teal-600"
                    />
                    <span>{builderText.stopCondition}</span>
                  </label>
                  <p className="mt-1 text-xs text-stone-500">
                    {builderText.stopConditionHint}
                  </p>

                  <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr]">
                    <label className="block">
                      <span className="text-xs font-medium text-stone-500">
                        {builderText.stopAtStep}
                      </span>
                      <select
                        value={normalizedWorkflowControl.stopConditionStep}
                        disabled={!normalizedWorkflowControl.stopConditionEnabled}
                        onChange={(event) =>
                          setWorkflowControl((current) => ({
                            ...current,
                            stopConditionStep: Number(event.target.value),
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-stone-100"
                      >
                        {workflowSteps.map((step) => (
                          <option key={`stop-step-${step.uid}`} value={step.orderIndex}>
                            {t("step")} {step.orderIndex}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-stone-500">
                        {builderText.qualityThreshold}
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={normalizedWorkflowControl.qualityThreshold}
                          disabled={!normalizedWorkflowControl.stopConditionEnabled}
                          onChange={(event) =>
                            setWorkflowControl((current) => ({
                              ...current,
                              qualityThreshold: Number(event.target.value),
                            }))
                          }
                          className="w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 disabled:bg-stone-100"
                        />
                        <span className="text-xs text-stone-500">
                          {builderText.qualityUnit}
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {exceedsSequentialLimit ? (
                  <p className="text-xs text-rose-700">{builderText.totalLimitNotice}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                placeholder={t("presetName")}
              />
              <input
                value={presetDescription}
                onChange={(event) => setPresetDescription(event.target.value)}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                placeholder={t("presetDescription")}
              />
              <button
                type="button"
                onClick={savePreset}
                className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                {t("saveRoute")}
              </button>
              <button
                type="button"
                onClick={runWorkbench}
                disabled={running || uploadingAttachments}
                className="rounded-md bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
              >
                {running ? t("running") : t("run")}
              </button>
            </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className={`space-y-4 ${mobilePanelClass("results")}`}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div
            ref={progressSectionRef}
            className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-950">
                  {uiText.progressTitle}
                </h2>
                <p className="text-sm text-stone-600">
                  {uiText.progressDescription}
                </p>
              </div>
              {runMonitor ? (
                <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">
                  {formatElapsedTime(runMonitor.startedAt, progressNow, language)}
                </span>
              ) : null}
            </div>

            {progressEntries.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {progressEntries.map((entry) => (
                  <article
                    key={entry.key}
                    className="rounded-lg border border-stone-200 bg-[#fbfcf8] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">
                          {entry.title}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                          {entry.subtitle}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                          entry.status === "completed"
                            ? "bg-teal-100 text-teal-800"
                            : entry.status === "failed"
                              ? "bg-rose-100 text-rose-700"
                              : entry.status === "skipped"
                                ? "bg-stone-200 text-stone-600"
                                : entry.status === "active"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-stone-100 text-stone-600"
                        }`}
                      >
                        {entry.status === "active" ? (
                          <svg
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            className="h-3.5 w-3.5 animate-[spin_1.2s_linear_infinite]"
                            fill="currentColor"
                          >
                            <path d="M4 2h8v2c0 1.63-1.03 3.09-2.56 4 1.53.91 2.56 2.37 2.56 4v2H4v-2c0-1.63 1.03-3.09 2.56-4C5.03 7.09 4 5.63 4 4V2Zm2 1v1c0 1.1.83 2.15 2 2.9 1.17-.75 2-1.8 2-2.9V3H6Zm0 10h4v-1c0-1.1-.83-2.15-2-2.9-1.17.75-2 1.8-2 2.9v1Z" />
                          </svg>
                        ) : null}
                        {entry.status === "completed"
                          ? t("statusCompleted")
                          : entry.status === "failed"
                            ? t("statusFailed")
                            : entry.status === "active"
                              ? t("statusRunning")
                              : entry.status === "skipped"
                                ? language === "ko"
                                  ? "건너뜀"
                                  : "Skipped"
                                : language === "ko"
                                  ? "대기"
                                  : "Queued"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-700">
                      {entry.detail ||
                        (entry.status === "queued" ? uiText.queued : uiText.running)}
                    </p>
                    {entry.workLines ? (
                      <div className="mt-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-600">
                        <p className="truncate">{entry.workLines[0]}</p>
                        <p className="truncate">{entry.workLines[1]}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-stone-200 bg-[#fbfcf8] px-4 py-6 text-sm text-stone-500">
                {uiText.noProgress}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 bg-[#fbfcf8] p-4">
            <h2 className="text-base font-semibold text-stone-950">
              {uiText.resultOverview}
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-medium text-stone-500">
                  {uiText.totalResults}
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">
                  {resultStats.total}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-medium text-stone-500">
                  {uiText.completedResults}
                </p>
                <p className="mt-2 text-2xl font-semibold text-teal-800">
                  {resultStats.completed}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-medium text-stone-500">
                  {uiText.failedResults}
                </p>
                <p className="mt-2 text-2xl font-semibold text-rose-700">
                  {resultStats.failed}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-medium text-stone-500">
                  {uiText.runningResults}
                </p>
                <p className="mt-2 text-2xl font-semibold text-amber-700">
                  {resultStats.running}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3">
              <p className="text-xs font-medium text-stone-500">
                {uiText.finalSelection}
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-950">
                {resultStats.finalLabel}
              </p>
            </div>
          </div>
        </div>

        {mode === "parallel" ? (
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-950">
                  {uiText.compareTitle}
                </h2>
                <p className="text-sm text-stone-600">
                  {uiText.compareDescription}
                </p>
              </div>
              {parallelComparison.status === "completed" ? (
                <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">
                  {uiText.compareGeneratedWith}:{" "}
                  {parallelComparison.comparison.provider}/
                  {getModelDisplayName(
                    parallelComparison.comparison.provider,
                    parallelComparison.comparison.model,
                  )}
                </span>
              ) : null}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-stone-500">
                {uiText.compareModels}
              </p>
              <div className="flex flex-wrap gap-2">
              {parallelComparisonCandidates.map((result) => (
                <span
                  key={result.id}
                  className="rounded-full border border-stone-200 bg-[#f7f8f3] px-3 py-1 text-xs font-medium text-stone-700"
                >
                  {result.provider}/{getModelDisplayName(
                    result.provider,
                    result.model,
                  )}
                </span>
              ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-stone-200 bg-[#fbfcf8] p-4">
              {parallelComparison.status === "loading" ? (
                <p className="flex items-center gap-2 text-sm leading-6 text-stone-700">
                  <span
                    aria-hidden="true"
                    className="inline-block animate-[spin_1.2s_linear_infinite]"
                  >
                    ⏳
                  </span>
                  {uiText.compareLoading}
                </p>
              ) : parallelComparison.status === "completed" ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-stone-800">
                  {parallelComparison.comparison.summary}
                </p>
              ) : parallelComparison.status === "failed" ? (
                <p className="text-sm leading-6 text-rose-700">
                  {parallelComparison.error || uiText.compareFailed}
                </p>
              ) : (
                <p className="text-sm leading-6 text-stone-500">
                  {uiText.compareEmpty}
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-950">
                {t("resultBoard")}
              </h2>
              <p className="text-sm text-stone-600">
                {t("resultBoardDescription")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {sessionId ? (
                <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">
                  {t("saved")}
                </span>
              ) : null}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-500">
                  {uiText.resultLayout}
                </span>
                <div className="inline-flex rounded-md border border-stone-200 bg-[#f7f8f3] p-1">
                  <button
                    type="button"
                    onClick={() => setResultLayout("single")}
                    className={`rounded px-3 py-1.5 text-xs font-semibold ${
                      resultLayout === "single"
                        ? "bg-white text-stone-950 shadow-sm"
                        : "text-stone-600"
                    }`}
                  >
                    {uiText.resultLayoutSingle}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultLayout("double")}
                    className={`rounded px-3 py-1.5 text-xs font-semibold ${
                      resultLayout === "double"
                        ? "bg-white text-stone-950 shadow-sm"
                        : "text-stone-600"
                    }`}
                  >
                    {uiText.resultLayoutDouble}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {results.length ? (
          <div
            className={
              resultLayout === "double"
                ? "grid gap-3 md:grid-cols-2"
                : "space-y-3"
            }
          >
            {displayResults.map((result) => {
              const parent = result.parentResultId
                ? results.find((item) => item.id === result.parentResultId)
                : null;
              return (
                <div key={result.id} className="min-w-0">
                  <ResultCard
                    result={result}
                    depth={resultDepths.get(result.id) ?? 0}
                    isFinal={finalResultId === result.id}
                    providers={providers}
                    sourceLabel={
                      parent
                        ? `${t("source")}: ${parent.provider}/${getModelDisplayName(
                            parent.provider,
                            parent.model,
                          )}`
                        : undefined
                    }
                    onBranch={runBranch}
                    onRerun={rerunResult}
                    onMarkFinal={markFinal}
                    onDelete={deleteBranch}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={t("noResultsTitle")}
            description={t("noResultsDescription")}
          />
        )}
      </section>
    </div>
  );
}
