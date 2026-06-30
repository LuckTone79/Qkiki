"use client";

import { withAdditionalLanguages } from "@/lib/i18n";

import { localize } from "@/lib/i18n";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getActionTypeDisplayLabel } from "@/lib/ai/action-display";
import { normalizeProviderModel } from "@/lib/ai/provider-catalog";
import { isImageDataUrl } from "@/lib/ai/image-output";
import {
  expandWorkflowSteps,
  MAX_REPEAT_BLOCKS,
  MAX_TOTAL_SEQUENTIAL_STEPS,
} from "@/lib/ai/workflow-control";
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
import {
  readBrowserStorageValueAny,
  writeBrowserStorageValue,
} from "@/lib/browser-storage";
import { PRIMARY_STORAGE_KEYS, LEGACY_STORAGE_KEYS } from "@/lib/brand";
import {
  buildWorkbenchSessionSearch,
  canAutoResumeFromSearch,
  pickLatestActiveSessionId,
  resolveWorkbenchEntryAction,
  shouldRevalidateWorkbenchOnPageResume,
} from "@/lib/workbench-resume";
import { getModelDisplayName } from "@/lib/ai/model-display";
import type { UsageErrorPayload, UsageStatus as UsageStatusType } from "@/lib/usage-types";
import {
  buildResultDomId,
  buildWorkbenchMobilePanels,
  NEW_WORKBENCH_EVENT,
} from "@/lib/workbench-sharing";
import { copyTextToClipboard } from "@/lib/browser-clipboard";
import { buildSessionInputCopyNotice } from "@/lib/session-input-copy";
import {
  buildResultDepthMap,
  partitionResultsForWorkbench,
  pickDisplayFinalResultId,
  prioritizePinnedResults,
  prioritizePinnedRootBranches,
  sortResultsForDisplay,
} from "@/lib/workbench-results";
import {
  buildCollapsedResultExpansionMap,
  mergeResultExpansionMap,
  setAllResultsExpanded,
} from "@/lib/workbench-result-expansion";
import {
  closeDetachedParallelComparisonPanel,
  createParallelComparisonPanelState,
  openDetachedParallelComparisonPanel,
  toggleParallelComparisonPanelCollapsed,
} from "@/lib/workbench-parallel-comparison-panel";
import { buildWorkbenchRunPayload } from "@/lib/workbench-run-payload";
import { estimateWorkbenchRunCredits } from "@/lib/credits";
import { getRunStreamRetryDelayMs } from "@/lib/run-stream-backoff";
import {
  buildResultBoardView,
  type ResultBoardFilter,
  type ResultBoardSort,
} from "@/lib/workbench-result-board";
import {
  finalizeRepeatCountDraft,
  sanitizeRepeatCountDraftInput,
} from "@/lib/repeat-count-input";
import { nextProviderSelectionForEnabledChange } from "@/lib/workbench-provider-selection";
import { resolveResultStartTarget } from "@/lib/workbench-result-scroll";

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
  workflowControlJson?: string | null;
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
  activeRun?: {
    runId: string;
    executionRunId: string;
    mode: "parallel" | "sequential";
    status: string;
    totalStepsPlanned: number;
    totalStepsDone: number;
    createdAt: string;
  } | null;
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

type SessionListEntry = {
  id: string;
  executionRuns?: Array<{
    status?: string | null;
  }>;
};

type RepeatBlockState = {
  id: string;
  startStep: number;
  endStep: number;
  repeatCount: number;
};

type WorkflowControlState = {
  repeatBlocks: RepeatBlockState[];
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
  | "skipped"
  | "canceled";

type RunProgressEntry = {
  key: string;
  title: string;
  subtitle: string;
  status: RunProgressStatus;
  orderIndex?: number;
  canStop?: boolean;
  detail?: string | null;
  workLines?: [string, string];
};

type RunMonitor = {
  mode: "parallel" | "sequential";
  startedAt: number;
  entries: RunProgressEntry[];
};

type OutputLanguage = AppLanguage | "zh" | "hi";

type WorkbenchRunStreamEvent =
  | {
      type: "session";
      session: { id: string; title: string; finalResultId?: string | null };
    }
  | {
      type: "run_plan";
      executionRun: {
        id: string;
        status: string;
        runnerVersion: string;
        totalStepsPlanned: number;
        totalStepsDone: number;
        totalStepsFailed: number;
        totalStepsRunning: number;
        totalStepsCanceled: number;
        finalResultId?: string | null;
      };
      runSteps: RunStepSnapshot[];
    }
  | {
      type: "progress";
      index: number;
      title?: string;
      subtitle?: string;
      actionType?: ActionType;
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
      streamError?: string;
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

type RunStepSnapshot = {
  id: string;
  orderIndex: number;
  templateStepIndex: number;
  actionType: ActionType;
  targetProvider: string;
  targetModel: string;
  sourceMode: string;
  repeatIteration?: number | null;
  repeatBlockIndex?: number | null;
  status: string;
  attemptCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  sourceTextSnapshotPreview?: string | null;
  promptSnapshotPreview?: string | null;
  result?: {
    id: string;
    outputText: string | null;
    status: string;
    provider: string;
    model: string;
    latencyMs: number | null;
  } | null;
};

type RunStatusSnapshot = {
  mode?: "parallel" | "sequential";
  status?: string;
  errorMessage?: string | null;
  streamError?: string | null;
  results?: WorkbenchResult[];
  finalResultId?: string | null;
  executionSummary?: {
    plannedTotal: number;
    executedTotal: number;
    stoppedEarly: boolean;
    stopReason?: string | null;
  };
  executionRun?: {
    id: string;
    status: string;
    runnerVersion: string;
    totalStepsPlanned: number;
    totalStepsDone: number;
    totalStepsFailed: number;
    totalStepsRunning: number;
    totalStepsCanceled: number;
    finalResultId?: string | null;
  };
  runSteps?: RunStepSnapshot[];
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

type ShareLinkOutcome = {
  url: string;
  copied: boolean;
};

const outputStyles = ["detailed", "short", "bullet", "table", "executive"];
const outputStyleLabels: Record<string, Record<AppLanguage, string>> = {
  detailed: withAdditionalLanguages({ en: "detailed", ko: "\uc790\uc138\ud788" }),
  short: withAdditionalLanguages({ en: "short", ko: "\uc9e7\uac8c" }),
  bullet: withAdditionalLanguages({ en: "bullet", ko: "\uae00\uba38\ub9ac\ud45c" }),
  table: withAdditionalLanguages({ en: "table", ko: "\ud45c" }),
  executive: withAdditionalLanguages({ en: "results-focused", ko: "\uacb0\uacfc\uc911\uc2ec" }),
};

const outputLanguages: OutputLanguage[] = ["en", "ko", "ja", "es", "zh", "hi"];
const outputLanguageLabels: Record<OutputLanguage, string> = {
  en: "English",
  ko: "\ud55c\uad6d\uc5b4",
  ja: "\u65e5\u672c\u8a9e",
  es: "Español",
  zh: "\u4e2d\u6587",
  hi: "\u0939\u093f\u0928\u094d\u0926\u0940",
};

const MAX_TEMPLATE_STEPS = 50;
const ATTACHMENT_ACCEPT =
  ".txt,.md,.csv,.json,.docx,.pdf,image/png,image/jpeg,image/webp,image/gif";
const MAX_ATTACHMENTS_PER_RUN = 8;

const draftText = withAdditionalLanguages({
  en: {
    restored: "Unsaved draft restored",
    dismiss: "Dismiss",
  },
  ko: {
    restored: "\uc784\uc2dc \uc800\uc7a5\ub41c \uc791\uc5c5\uc744 \ubcf5\uc6d0\ud588\uc2b5\ub2c8\ub2e4",
    dismiss: "\ub2eb\uae30",
  },
});

const workflowBuilderText: Record<
  AppLanguage,
  {
    repeatSettings: string;
    repeatRange: string;
    repeatStart: string;
    repeatEnd: string;
    repeatCount: string;
    addRepeatBlock: string;
    repeatBlockLimit: string;
    noRepeatBlocks: string;
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
> = withAdditionalLanguages({
  en: {
    repeatSettings: "Repeat settings",
    repeatRange: "Repeat range",
    repeatStart: "Start step",
    repeatEnd: "End step",
    repeatCount: "Repeat count",
    addRepeatBlock: "Add repeat block",
    repeatBlockLimit: "You can configure up to 10 repeat blocks.",
    noRepeatBlocks: "No repeat blocks yet. Add one to repeat part of the chain.",
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
    addRepeatBlock: "\uBC18\uBCF5 \uAD6C\uAC04 \uCD94\uAC00",
    repeatBlockLimit: "\uBC18\uBCF5 \uAD6C\uAC04\uC740 \uCD5C\uB300 10\uAC1C\uAE4C\uC9C0 \uC124\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    noRepeatBlocks:
      "\uC544\uC9C1 \uBC18\uBCF5 \uAD6C\uAC04\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uCCB4\uC778 \uC77C\uBD80\uB97C \uBC18\uBCF5\uD558\uB824\uBA74 \uAD6C\uAC04\uC744 \uCD94\uAC00\uD558\uC138\uC694.",
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
});

const workbenchUiText = withAdditionalLanguages({
  en: {
    progressTitle: "AI progress",
    progressDescription:
      "Live status and actual visible input/output snippets for each run.",
    resultOverview: "Result overview",
    resultLayout: "Result layout",
    resultLayoutSingle: "1 column",
    resultLayoutDouble: "2 columns",
    collapseAllResults: "Collapse all",
    expandAllResults: "Expand all",
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
    canceled: "Stopped by user request.",
    stopStep: "Stop step",
    stoppingStep: "Stopping...",
    stepStopRequested: "This step stop was requested.",
    stepStopped: "Step stopped by user request.",
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
    compareCollapse: "Collapse",
    compareExpand: "Expand",
    compareDetach: "Open separately",
    compareCloseDetached: "Close separate view",
    compareDetachedHint: "The separate comparison view is open.",
  },
  ko: {
    progressTitle: "AI 진행 상태",
    progressDescription:
      "각 실행의 현재 상태와 실제 입력/출력 미리보기를 보여줍니다.",
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
    canceled: "사용자 요청으로 중지됐습니다.",
    stopStep: "\ub2e8\uacc4 \uc911\uc9c0",
    stoppingStep: "\uc911\uc9c0 \uc911...",
    stepStopRequested: "\uc774 \ub2e8\uacc4 \uc911\uc9c0\ub97c \uc694\uccad\ud588\uc2b5\ub2c8\ub2e4.",
    stepStopped: "\ub2e8\uacc4\uac00 \uc911\uc9c0\ub418\uc5c8\uc2b5\ub2c8\ub2e4.",
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
    compareCollapse: "접기",
    compareExpand: "펼치기",
    compareDetach: "별도 보기",
    compareCloseDetached: "별도 보기 닫기",
    compareDetachedHint: "별도 보기 창이 열려 있습니다.",
  },
});

function newUid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function defaultPresetName(language: AppLanguage) {
  return localize(language, { en: "Three-step review chain", ko: "3\ub2e8\uacc4 \uac80\ud1a0 \uccb4\uc778", ja: "3 \u6BB5\u968E\u306E\u30EC\u30D3\u30E5\u30FC \u30C1\u30A7\u30FC\u30F3", es: "Cadena de revisi\u00F3n de tres pasos" });
}

function defaultPresetDescription(language: AppLanguage) {
  return localize(language, { en: "Generate, critique, and improve.", ko: "\uc0dd\uc131, \ube44\ud310, \uac1c\uc120.", ja: "\u751F\u6210\u3057\u3001\u6279\u8A55\u3057\u3001\u6539\u5584\u3057\u307E\u3059\u3002", es: "Generar, criticar y mejorar." });
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
        localize(language, { en: "Draft a strong first answer.", ko: "\uac15\ud55c \uccab \ub2f5\ubcc0\uc744 \uc791\uc131\ud558\uc138\uc694.", ja: "\u5F37\u529B\u306A\u6700\u521D\u306E\u56DE\u7B54\u306E\u8349\u6848\u3092\u4F5C\u6210\u3057\u307E\u3059\u3002", es: "Redacte una primera respuesta s\u00F3lida." }),
    },
    {
      uid: newUid(),
      orderIndex: 2,
      actionType: "critique",
      targetProvider: "xai",
      targetModel: "grok-4.3",
      sourceMode: "previous",
      instructionTemplate:
        localize(language, { en: "Be concrete about flaws and missing angles.", ko: "\uacb0\ud568\uacfc \ube60\uc9c4 \uad00\uc810\uc744 \uad6c\uccb4\uc801\uc73c\ub85c \uc9da\uc5b4\uc8fc\uc138\uc694.", ja: "\u6B20\u9665\u3084\u6B20\u3051\u3066\u3044\u308B\u89D2\u5EA6\u306B\u3064\u3044\u3066\u5177\u4F53\u7684\u306B\u8AAC\u660E\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Sea concreto acerca de los defectos y los \u00E1ngulos faltantes." }),
    },
    {
      uid: newUid(),
      orderIndex: 3,
      actionType: "improve",
      targetProvider: "google",
      targetModel: "gemini-3-flash-preview",
      sourceMode: "previous",
      instructionTemplate:
        localize(language, { en: "Turn the critique into a better version.", ko: "\ube44\ud310 \ub0b4\uc6a9\uc744 \ub354 \ub098\uc740 \ubc84\uc804\uc73c\ub85c \ubc14\uafb8\uc138\uc694.", ja: "\u6279\u8A55\u3092\u3088\u308A\u826F\u3044\u3082\u306E\u306B\u5909\u3048\u307E\u3057\u3087\u3046\u3002", es: "Convierte la cr\u00EDtica en una mejor versi\u00F3n." }),
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
      const normalizedModel = normalizeProviderModel(
        step.targetProvider,
        step.targetModel,
      );

      if (!provider) {
        return {
          ...step,
          targetModel: normalizedModel,
        };
      }

      if (provider.models.includes(normalizedModel)) {
        return normalizedModel === step.targetModel
          ? step
          : {
              ...step,
              targetModel: normalizedModel,
            };
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
  ])
    .map((model) => normalizeProviderModel(provider.providerName, model))
    .filter((model) => provider.models.includes(model));

  return {
    enabled: selection?.enabled ?? provider.isEnabled,
    models: nextModels.length ? nextModels : [],
  };
}

function normalizeImageSelection(
  selection: Partial<ProviderSelection> | undefined,
  provider: ProviderOption,
): ProviderSelection {
  const imageModels = provider.imageModels ?? [];
  const nextModels = dedupeModels(
    Array.isArray(selection?.models) ? selection.models : [],
  ).filter((model) => imageModels.includes(model));

  // Image generation is opt-in: default to disabled and only enabled while at
  // least one image model is selected.
  return {
    enabled: Boolean(selection?.enabled) && nextModels.length > 0,
    models: nextModels,
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
  const units = localize(language, { en: ["B", "KB", "MB", "GB"], ko: ["B", "KB", "MB", "GB"], ja: ["B", "KB", "MB", "GB"], es: ["B", "KB", "MB", "GB"] });
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
  if (kind === "TEXT") {
    return localize(language, { en: "Text", ko: "텍스트", ja: "Text", es: "Text" });
  }
  if (kind === "IMAGE") {
    return localize(language, { en: "Image", ko: "이미지", ja: "Image", es: "Image" });
  }
  return "PDF";
}

function createRepeatBlock(stepCount: number): RepeatBlockState {
  const maxStep = Math.max(1, stepCount);
  return {
    id: newUid(),
    startStep: 1,
    endStep: Math.min(2, maxStep),
    repeatCount: 2,
  };
}

function defaultWorkflowControlState(): WorkflowControlState {
  return {
    repeatBlocks: [],
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
  const stopConditionStep = clampInteger(control.stopConditionStep, 1, maxStep);

  return {
    ...control,
    repeatBlocks: (control.repeatBlocks || [])
      .slice(0, MAX_REPEAT_BLOCKS)
      .map((repeatBlock) => {
        const startStep = clampInteger(repeatBlock.startStep, 1, maxStep);
        const endStep = clampInteger(repeatBlock.endStep, startStep, maxStep);
        return {
          ...repeatBlock,
          startStep,
          endStep,
          repeatCount: clampInteger(
            repeatBlock.repeatCount,
            1,
            MAX_TOTAL_SEQUENTIAL_STEPS,
          ),
        };
      }),
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

  if (!control.repeatBlocks.length) {
    return stepCount;
  }

  let total = 0;
  let nextBaseStep = 1;

  for (const repeatBlock of control.repeatBlocks) {
    const startStep = clampInteger(repeatBlock.startStep, 1, stepCount);
    const endStep = clampInteger(repeatBlock.endStep, startStep, stepCount);

    if (startStep > nextBaseStep) {
      total += startStep - nextBaseStep;
    }

    total +=
      (endStep - startStep + 1) *
      clampInteger(repeatBlock.repeatCount, 1, MAX_TOTAL_SEQUENTIAL_STEPS);
    nextBaseStep = Math.max(nextBaseStep, endStep + 1);
  }

  if (nextBaseStep <= stepCount) {
    total += stepCount - nextBaseStep + 1;
  }

  return total;
}

function workflowControlToInput(
  control: WorkflowControlState,
) {
  return {
    repeatBlocks: control.repeatBlocks.map((repeatBlock) => ({
      startStepOrder: repeatBlock.startStep,
      endStepOrder: repeatBlock.endStep,
      repeatCount: repeatBlock.repeatCount,
    })),
    stopCondition: {
      enabled: control.stopConditionEnabled,
      checkStepOrder: control.stopConditionStep,
      qualityThreshold: control.qualityThreshold,
    },
  } satisfies WorkflowControlInput;
}

function workflowControlFromInput(
  candidate: WorkflowControlInput | undefined,
  currentStepCount: number,
) {
  const fallback = normalizeWorkflowControlState(
    defaultWorkflowControlState(),
    currentStepCount,
  );

  if (!candidate) {
    return fallback;
  }

  const repeatBlocks = Array.isArray(candidate.repeatBlocks)
    ? candidate.repeatBlocks
    : candidate.repeat?.enabled
      ? [
          {
            startStepOrder: candidate.repeat.startStepOrder,
            endStepOrder: candidate.repeat.endStepOrder,
            repeatCount: candidate.repeat.repeatCount,
          },
        ]
      : [];

  return normalizeWorkflowControlState(
    {
      repeatBlocks: repeatBlocks.map((repeatBlock, index) => ({
        id: `repeat-${index + 1}`,
        startStep: repeatBlock.startStepOrder,
        endStep: repeatBlock.endStepOrder,
        repeatCount: repeatBlock.repeatCount,
      })),
      stopConditionEnabled: candidate.stopCondition?.enabled ?? false,
      stopConditionStep:
        candidate.stopCondition?.checkStepOrder ?? fallback.stopConditionStep,
      qualityThreshold:
        candidate.stopCondition?.qualityThreshold ?? fallback.qualityThreshold,
    },
    currentStepCount,
  );
}

function expandWorkflowStepsForMonitor(
  steps: WorkflowStepState[],
  control: WorkflowControlState,
) {
  try {
    return expandWorkflowSteps(
      steps,
      workflowControlToInput(control),
    ) as WorkflowStepState[];
  } catch {
    return steps;
  }
}

function mergeResults(current: WorkbenchResult[], incoming: WorkbenchResult[]) {
  const map = new Map(current.map((result) => [result.id, result]));
  incoming.forEach((result) => {
    const existing = map.get(result.id);
    map.set(result.id, pickPreferredResult(existing, result));
  });
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function isTerminalResultStatus(status: string) {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "canceled" ||
    status === "skipped"
  );
}

function resultStatusRank(status: string) {
  if (isTerminalResultStatus(status)) {
    return 2;
  }

  if (status === "running") {
    return 1;
  }

  return 0;
}

function resultUpdatedAtMs(result: WorkbenchResult) {
  return new Date(result.updatedAt || result.createdAt).getTime();
}

function pickPreferredResult(
  existing: WorkbenchResult | undefined,
  incoming: WorkbenchResult,
) {
  if (!existing) {
    return incoming;
  }

  const existingRank = resultStatusRank(existing.status);
  const incomingRank = resultStatusRank(incoming.status);
  if (incomingRank < existingRank) {
    return existing;
  }

  if (incomingRank > existingRank) {
    return incoming;
  }

  return resultUpdatedAtMs(incoming) >= resultUpdatedAtMs(existing)
    ? incoming
    : existing;
}

function resultProgressStatus(result: WorkbenchResult): RunProgressStatus {
  if (result.status === "running") {
    return "active";
  }

  if (result.status === "failed") {
    return "failed";
  }

  if (result.status === "canceled") {
    return "canceled";
  }

  if (result.status === "skipped") {
    return "skipped";
  }

  return "completed";
}

function progressStatusRank(status: RunProgressStatus) {
  if (status === "completed" || status === "failed" || status === "skipped" || status === "canceled") {
    return 2;
  }

  if (status === "active") {
    return 1;
  }

  return 0;
}

function mapRunStepStatusToProgressStatus(status: string): RunProgressStatus {
  if (status === "running" || status === "retrying") {
    return "active";
  }

  if (status === "completed") {
    return "completed";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "canceled") {
    return "canceled";
  }

  if (status === "skipped") {
    return "skipped";
  }

  return "queued";
}

function buildRunMonitorFromRunSteps(input: {
  runSteps: RunStepSnapshot[];
  language: AppLanguage;
  uiText: {
    queued: string;
    running: string;
    preparing: string;
    completed: string;
  };
  startedAt?: number;
}) {
  return {
    mode: "sequential" as const,
    startedAt: input.startedAt ?? Date.now(),
    entries: input.runSteps.map((step) => {
      const progressStatus = mapRunStepStatusToProgressStatus(step.status);
      const repeatLabel =
        step.repeatIteration && step.repeatIteration > 0
          ? localize(input.language, { en: `Iteration ${step.repeatIteration}`, ko: `${step.repeatIteration}회차`, ja: `\u53CD\u5FA9${step.repeatIteration}`, es: `Iteraci\u00F3n${step.repeatIteration}` })
          : null;
      const subtitleParts = [
        localize(input.language, { en: `Step ${step.orderIndex}`, ko: `실행 ${step.orderIndex}단계`, ja: `\u30B9\u30C6\u30C3\u30D7${step.orderIndex}`, es: `Paso${step.orderIndex}` }),
        localize(input.language, { en: `Template ${step.templateStepIndex}`, ko: `템플릿 ${step.templateStepIndex}단계`, ja: `\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8${step.templateStepIndex}`, es: `Plantilla${step.templateStepIndex}` }),
        getActionTypeDisplayLabel(step.actionType, input.language),
        repeatLabel,
      ].filter(Boolean);

      return {
        key: step.id,
        title: `${step.targetProvider} / ${getModelDisplayName(
          step.targetProvider as ProviderName,
          step.targetModel,
        )}`,
        subtitle: subtitleParts.join(" - "),
        status: progressStatus,
        orderIndex: step.orderIndex,
        canStop: step.status === "queued",
        detail:
          step.errorMessage ||
          step.promptSnapshotPreview ||
          step.sourceTextSnapshotPreview ||
          (progressStatus === "completed"
            ? input.uiText.completed
            : progressStatus === "queued"
              ? input.uiText.queued
              : input.uiText.running),
      } satisfies RunProgressEntry;
    }),
  };
}

function formatElapsedTime(startedAt: number, now: number, language: AppLanguage) {
  const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (elapsedSeconds < 60) {
    return localize(language, { en: `${elapsedSeconds}s elapsed`, ko: `${elapsedSeconds}초 경과`, ja: `${elapsedSeconds}\u79D2\u304C\u7D4C\u904E\u3057\u307E\u3057\u305F`, es: `${elapsedSeconds}ha transcurrido` });
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return localize(language, { en: `${minutes}m ${seconds}s elapsed`, ko: `${minutes}분 ${seconds}초 경과`, ja: `${minutes}\u30E1\u30FC\u30C8\u30EB${seconds}\u79D2\u304C\u7D4C\u904E\u3057\u307E\u3057\u305F`, es: `${minutes}metro${seconds}ha transcurrido` });
}

function defaultOutputLanguageForAppLanguage(language: AppLanguage): OutputLanguage {
  return language;
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
  return localize(input.language, { en: [`Current work: ${input.primary}`, `Actual input/output: ${input.secondary}`], ko: [`현재 작업: ${input.primary}`, `실제 입력/출력: ${input.secondary}`], ja: [`Current work: ${input.primary}`, `Actual input/output: ${input.secondary}`], es: [`Current work: ${input.primary}`, `Actual input/output: ${input.secondary}`] }) as [string, string];
}

function activeWorkLines(
  entry: RunProgressEntry,
  _elapsedMs: number,
  language: AppLanguage,
) {
  if (entry.status !== "active") {
    return entry.workLines ?? null;
  }

  return entry.workLines ?? [
    localize(language, { en: "Waiting for the model response", ko: "모델 응답 대기 중", ja: "\u30E2\u30C7\u30EB\u306E\u5FDC\u7B54\u3092\u5F85\u3063\u3066\u3044\u307E\u3059", es: "Esperando la respuesta del modelo." }),
    localize(language, { en: "No model output has arrived yet.", ko: "아직 모델 출력이 도착하지 않았습니다.", ja: "\u30E2\u30C7\u30EB\u51FA\u529B\u306F\u307E\u3060\u5230\u7740\u3057\u3066\u3044\u307E\u305B\u3093\u3002", es: "A\u00FAn no ha llegado ning\u00FAn modelo." }),
  ];
}

type WorkbenchClientProps = {
  isTrialMode?: boolean;
};

export function WorkbenchClient({ isTrialMode = false }: WorkbenchClientProps = {}) {
  const { language, t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [imageMode, setImageMode] = useState(false);
  const [imageSelections, setImageSelections] = useState<
    Partial<Record<ProviderName, ProviderSelection>>
  >({});
  const [workflowSteps, setWorkflowSteps] =
    useState<WorkflowStepState[]>(() => initialSteps(language));
  const [workflowControl, setWorkflowControl] = useState<WorkflowControlState>(
    () => defaultWorkflowControlState(),
  );
  const [repeatCountDraftById, setRepeatCountDraftById] = useState<Record<string, string>>(
    {},
  );
  const [attachments, setAttachments] = useState<WorkbenchAttachment[]>([]);
  const [results, setResults] = useState<WorkbenchResult[]>([]);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [resultExpansionById, setResultExpansionById] = useState<Record<string, boolean>>(
    () => buildCollapsedResultExpansionMap([]),
  );
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState(() => defaultPresetName(language));
  const [presetDescription, setPresetDescription] = useState(() =>
    defaultPresetDescription(language),
  );
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [cancelingRun, setCancelingRun] = useState(false);
  const [stoppingStepIndexes, setStoppingStepIndexes] = useState<Set<number>>(
    () => new Set<number>(),
  );
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [draftBanner, setDraftBanner] = useState<{ savedAt: number } | null>(null);
  const [activeMobilePanel, setActiveMobilePanel] =
    useState<MobilePanel>("input");
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetSavedAt, setPresetSavedAt] = useState<number | null>(null);
  const [inputCopied, setInputCopied] = useState(false);
  const [resultLayout, setResultLayout] = useState<ResultLayout>("double");
  const [resultFilter, setResultFilter] = useState<ResultBoardFilter>("all");
  const [resultSort, setResultSort] = useState<ResultBoardSort>("workflow");
  const [resultSearch, setResultSearch] = useState("");
  const [runMonitor, setRunMonitor] = useState<RunMonitor | null>(null);
  const [usage, setUsage] = useState<UsageStatusType | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [parallelComparison, setParallelComparison] =
    useState<ParallelComparisonState>({
      signature: "",
      status: "idle",
    });
  const [parallelComparisonPanel, setParallelComparisonPanel] = useState(() =>
    createParallelComparisonPanelState(),
  );
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const [sharingSession, setSharingSession] = useState(false);
  const [sessionShareCopied, setSessionShareCopied] = useState(false);
  const [sessionShareUrl, setSessionShareUrl] = useState<string | null>(null);
  const [sessionShareCopyBlocked, setSessionShareCopyBlocked] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const creditWarningRef = useRef<HTMLDivElement | null>(null);
  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const parallelComparisonRef = useRef(parallelComparison);
  const activeRunIdRef = useRef<string | null>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const routeSyncReadyRef = useRef(false);
  const autoResumeSessionIdRef = useRef<string | null>(null);
  const skippedAutoResumeSessionIdRef = useRef<string | null>(null);
  const autoResumeRequestIdRef = useRef(0);

  useEffect(() => {
    parallelComparisonRef.current = parallelComparison;
  }, [parallelComparison]);

  useEffect(() => {
    if (!parallelComparisonPanel.detached) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setParallelComparisonPanel((current) =>
          closeDetachedParallelComparisonPanel(current),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [parallelComparisonPanel.detached]);

  function setCurrentRunId(runId: string | null) {
    activeRunIdRef.current = runId;
    setActiveRunId(runId && runId !== "pending" ? runId : null);
  }

  useEffect(() => {
    setSessionShareUrl(null);
    setSessionShareCopied(false);
    setSessionShareCopyBlocked(false);
  }, [sessionId]);

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

  function focusCreditWarning() {
    setActiveMobilePanel("input");
    window.setTimeout(() => {
      const warning = creditWarningRef.current;
      if (!warning) {
        return;
      }

      warning.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      warning.focus({ preventScroll: true });
    }, 50);
  }

  function updateProgressEntry(input: {
    index: number;
    status?: RunProgressStatus;
    detail?: string | null;
    title?: string;
    subtitle?: string;
    workLines?: [string, string] | null;
  }) {
    setRunMonitor((current) => {
      if (!current) {
        return current;
      }

      let entries = [...current.entries];
      const existing = entries[input.index];
      const incomingStatus = input.status || existing?.status || "active";
      if (
        existing &&
        progressStatusRank(incomingStatus) < progressStatusRank(existing.status)
      ) {
        return current;
      }

      if (current.mode === "sequential" && incomingStatus === "active") {
        entries = entries.map((entry, index) =>
          index !== input.index && entry.status === "active"
            ? { ...entry, status: "queued", detail: uiText.queued }
            : entry,
        );
      }

      entries[input.index] = {
        key: existing?.key ?? `stream-${input.index}`,
        title: input.title || existing?.title || `${uiText.sequentialStep} ${input.index + 1}`,
        subtitle:
          input.subtitle ||
          existing?.subtitle ||
          `${current.mode === "parallel" ? uiText.parallelRun : uiText.sequentialStep} ${
            input.index + 1
          }`,
        status: incomingStatus,
        detail:
          input.detail === undefined
            ? existing?.detail ?? uiText.running
            : input.detail,
        orderIndex: existing?.orderIndex,
        canStop:
          incomingStatus === "queued"
            ? true
            : incomingStatus === "active"
              ? false
              : existing?.canStop ?? false,
        workLines:
          input.workLines === undefined ? existing?.workLines : input.workLines ?? undefined,
      };

      return { ...current, entries };
    });
  }

  function restoreProgressEntry(index: number, entry: RunProgressEntry | undefined) {
    if (!entry) {
      return;
    }

    setRunMonitor((current) => {
      if (!current) {
        return current;
      }

      const entries = [...current.entries];
      entries[index] = entry;
      return { ...current, entries };
    });
  }

  function jumpToResult(resultId: string) {
    setResultExpansionById((current) => ({
      ...current,
      [resultId]: true,
    }));

    const scrollToResult = () => {
      const element = document.getElementById(buildResultDomId(resultId));
      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const needsReset = resultFilter !== "all" || resultSearch.trim().length > 0;
    if (needsReset) {
      setResultFilter("all");
      setResultSearch("");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(scrollToResult);
      });
      return;
    }

    scrollToResult();
  }

  function toggleResultExpanded(resultId: string) {
    setResultExpansionById((current) => ({
      ...current,
      [resultId]: !(current[resultId] ?? false),
    }));
  }

  function collapseAllResults() {
    setResultExpansionById((current) => ({
      ...current,
      ...buildCollapsedResultExpansionMap(displayResults),
    }));
  }

  function expandAllResults() {
    setResultExpansionById((current) => ({
      ...current,
      ...setAllResultsExpanded(displayResults, true),
    }));
  }

  function resetResultBoardControls() {
    setResultFilter("all");
    setResultSort("workflow");
    setResultSearch("");
  }

  function createRunMonitor(
    modeToRun: "parallel" | "sequential",
    monitorSteps?: WorkflowStepState[],
    monitorControl?: WorkflowControlState,
  ) {
    const startedAt = Date.now();
    const stepsForMonitor = monitorSteps ?? workflowSteps;
    if (modeToRun === "parallel") {
      const parallelEntries =
        stepsForMonitor.length > 0
          ? stepsForMonitor.map((step, index) => ({
              key: `parallel-step-${step.uid}`,
              title: `${providerLabel(step.targetProvider)} / ${getModelDisplayName(
                step.targetProvider,
                step.targetModel,
              )}`,
              subtitle: `${uiText.parallelRun} ${index + 1}`,
              status: "active" as const,
              canStop: false,
              detail: uiText.preparing,
              workLines: buildWorkLines({
                language,
                primary:
                  localize(language, { en: "Generating a parallel answer for the original task", ko: "\uc6d0\ubcf8 \uc9c8\ubb38\uc5d0 \ub300\ud55c \ubcd1\ub82c \ub2f5\ubcc0 \uc0dd\uc131", ja: "\u5143\u306E\u30BF\u30B9\u30AF\u306B\u5BFE\u3059\u308B\u4E26\u5217\u56DE\u7B54\u306E\u751F\u6210", es: "Generar una respuesta paralela para la tarea original." }),
                secondary: compactPreview(originalInput, uiText.preparing),
              }),
            }))
          : selectedTargets.map((target, index) => ({
              key: `parallel-${target.provider}-${target.model}-${index}`,
              title: `${providerLabel(target.provider as ProviderName)} / ${getModelDisplayName(
                target.provider as ProviderName,
                target.model,
              )}`,
              subtitle: `${uiText.parallelRun} ${index + 1}`,
              status: "active" as const,
              canStop: false,
              detail: uiText.preparing,
              workLines: buildWorkLines({
                language,
                primary:
                  localize(language, { en: "Generating a parallel answer for the original task", ko: "\uc6d0\ubcf8 \uc9c8\ubb38\uc5d0 \ub300\ud55c \ubcd1\ub82c \ub2f5\ubcc0 \uc0dd\uc131", ja: "\u5143\u306E\u30BF\u30B9\u30AF\u306B\u5BFE\u3059\u308B\u4E26\u5217\u56DE\u7B54\u306E\u751F\u6210", es: "Generar una respuesta paralela para la tarea original." }),
                secondary: compactPreview(originalInput, uiText.preparing),
              }),
            }));

      return {
        mode: "parallel" as const,
        startedAt,
        entries: parallelEntries,
      };
    }

    const expandedStepsForMonitor = expandWorkflowStepsForMonitor(
      stepsForMonitor,
      monitorControl ?? normalizedWorkflowControl,
    );

    return {
      mode: "sequential" as const,
      startedAt,
      entries: expandedStepsForMonitor.map((step, index) => ({
        key: `step-${step.uid}-${index + 1}`,
        title: `${providerLabel(step.targetProvider)} / ${getModelDisplayName(
          step.targetProvider,
          step.targetModel,
        )}`,
        subtitle: `${uiText.sequentialStep} ${index + 1} - ${getActionTypeDisplayLabel(
          step.actionType,
          language,
        )}`,
        status: index === 0 ? ("active" as const) : ("queued" as const),
        orderIndex: index + 1,
        canStop: index !== 0,
        detail: index === 0 ? uiText.preparing : uiText.queued,
        workLines: buildWorkLines({
          language,
          primary: compactPreview(
            step.instructionTemplate,
            localize(language, { en: "Applying the sequential step instruction", ko: "\uc21c\ucc28 \ub2e8\uacc4 \uc9c0\uc2dc\uc0ac\ud56d \uc801\uc6a9", ja: "\u30B7\u30FC\u30B1\u30F3\u30B7\u30E3\u30EB\u30B9\u30C6\u30C3\u30D7\u547D\u4EE4\u306E\u9069\u7528", es: "Aplicar la instrucci\u00F3n de pasos secuenciales" }),
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
    streamError?: string;
  }) {
    setRunMonitor((current) => {
      const base = current ?? createRunMonitor(input.mode);
      const resultsByEntryIndex = new Map<number, WorkbenchResult>();
      input.results.forEach((result, fallbackIndex) => {
        const entryIndex =
          typeof result.executionRunStep?.orderIndex === "number"
            ? result.executionRunStep.orderIndex - 1
            : typeof result.executionOrder === "number"
              ? result.executionOrder - 1
              : typeof result.workflowStep?.orderIndex === "number"
                ? result.workflowStep.orderIndex - 1
            : fallbackIndex;
        resultsByEntryIndex.set(entryIndex, result);
      });
      const entries = base.entries.map((entry, index) => {
        const result = resultsByEntryIndex.get(index);

        if (result) {
          const progressStatus = resultProgressStatus(result);
          return {
            ...entry,
            status: progressStatus,
            detail:
              progressStatus === "failed"
                ? result.errorMessage || uiText.failed
                : progressStatus === "canceled"
                  ? result.errorMessage || uiText.stepStopped
                  : progressStatus === "skipped"
                    ? uiText.skipped
                    : uiText.completed,
          };
        }

        if (input.executionSummary?.stoppedEarly) {
          return {
            ...entry,
            status: "skipped" as const,
            detail: uiText.skipped,
          };
        }

        if (input.streamError && entry.status === "active") {
          return {
            ...entry,
            status: "failed" as const,
            detail: input.streamError,
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
    if (data.code === "CREDIT_LIMIT_REACHED") {
      setLimitModalOpen(true);
      focusCreditWarning();
      return true;
    }

    return false;
  }

  async function loadUsageStatus(options?: { preferCache?: boolean }) {
    const preferCache = options?.preferCache ?? true;
    const cached = preferCache ? readUsageCache<UsageStatusType>() : null;
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
      const nextWorkflowControl = workflowControlFromInput(
        parsed.workflowControl as WorkflowControlInput | undefined,
        parsedSteps.length,
      );
      setWorkflowSteps(nextSteps);
      setWorkflowControl(nextWorkflowControl);
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
      setError(localize(language, { en: data.error || t("runFailed"), ko: t("runFailed"), ja: data.error || t("runFailed"), es: data.error || t("runFailed") }));
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

  function parseWorkflowControlJson(value?: string | null) {
    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value) as WorkflowControlInput;
    } catch {
      return undefined;
    }
  }

  function toSessionWorkflowSteps(session: LoadedSession) {
    if (!session.workflowSteps.length) {
      return initialSteps(language);
    }

    return normalizeStepsForProviders(
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
    );
  }

  function applySessionToState(session: LoadedSession) {
    const sessionWorkflowSteps = toSessionWorkflowSteps(session);
    const sessionWorkflowControl = workflowControlFromInput(
      parseWorkflowControlJson(session.workflowControlJson),
      sessionWorkflowSteps.length,
    );
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
    resetResultBoardControls();
    setWorkflowSteps(sessionWorkflowSteps);
    setWorkflowControl(sessionWorkflowControl);
  }

  function restoreDraftOrDefaultState() {
    setSessionId(null);
    setProject(null);
    setSessionTitle("");
    setFinalResultId(null);
    setResults([]);
    setRunMonitor(null);
    setNotice("");
    setCurrentRunId(null);
    setRunning(false);
    setStoppingStepIndexes(new Set<number>());
    resetResultBoardControls();

    const draft = loadDraft();
    if (draft && draft.originalInput.trim()) {
      const draftWorkflowSteps = sortSteps(
        draft.workflowSteps.map((step) => ({
          ...step,
          uid: step.uid || newUid(),
          actionType: step.actionType as ActionType,
          targetProvider: step.targetProvider as ProviderName,
          sourceMode: step.sourceMode as WorkflowStepState["sourceMode"],
        })),
      );
      const draftWorkflowControl = workflowControlFromInput(
        draft.workflowControl as WorkflowControlInput | undefined,
        draft.workflowSteps.length || initialSteps(language).length,
      );
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
      setWorkflowSteps(draftWorkflowSteps);
      setWorkflowControl(draftWorkflowControl);
      setDraftBanner({ savedAt: draft.savedAt });
      return;
    }

    const nextSteps = initialSteps(language);
    setOriginalInput("");
    setAdditionalInstruction("");
    setOutputStyle("detailed");
    setOutputLanguage(defaultOutputLanguageForAppLanguage(language));
    setMode("parallel");
    setAttachments([]);
    setWorkflowSteps(nextSteps);
    setWorkflowControl(
      normalizeWorkflowControlState(
        defaultWorkflowControlState(),
        nextSteps.length,
      ),
    );
    setDraftBanner(null);
  }

  async function resumeActiveRun(session: LoadedSession) {
    if (!session.activeRun?.runId || activeRunIdRef.current) {
      return;
    }

    const modeToRun =
      session.activeRun.mode === "sequential" ? "sequential" : "parallel";
    const sessionWorkflowSteps = toSessionWorkflowSteps(session);
    const sessionWorkflowControl = workflowControlFromInput(
      parseWorkflowControlJson(session.workflowControlJson),
      sessionWorkflowSteps.length,
    );

    setError("");
    setNotice(
      localize(language, { en: "Resuming the active run.", ko: "진행 중인 실행을 이어받는 중입니다.", ja: "\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u5B9F\u884C\u3092\u518D\u958B\u3057\u307E\u3059\u3002", es: "Reanudando la ejecuci\u00F3n activa." }),
    );
    setProgressNow(Date.now());
    focusProgressPanel();
    setRunning(true);
    setCurrentRunId(session.activeRun.runId);

    try {
      const initialStatus = await fetchRunStatus(session.activeRun.runId);
      if (initialStatus?.runSteps?.length) {
        setRunMonitor(
          buildRunMonitorFromRunSteps({
            runSteps: initialStatus.runSteps,
            language,
            uiText,
          }),
        );
        if (initialStatus.results?.length) {
          setResults((current) => mergeResults(current, initialStatus.results || []));
        }
        if (initialStatus.finalResultId) {
          setFinalResultId(initialStatus.finalResultId);
        }
      } else {
        setRunMonitor(
          createRunMonitor(modeToRun, sessionWorkflowSteps, sessionWorkflowControl),
        );
      }

      const streamed = await readRunStream(
        session.activeRun.runId,
        initialStatus?.results?.length ? initialStatus.results : session.results,
      );
      if (cancelRequestedRef.current) {
        return;
      }
      if (streamed) {
        applyCompletedRun(streamed, modeToRun);
      }
    } catch (resumeError) {
      console.warn("Failed to resume active run", resumeError);
      setNotice(
        localize(language, { en: "The session loaded, but the previous active run could not be resumed.", ko: "세션 내용은 불러왔지만 이전 실행 복구에는 실패했습니다.", ja: "\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u30ED\u30FC\u30C9\u3055\u308C\u307E\u3057\u305F\u304C\u3001\u4EE5\u524D\u306E\u30A2\u30AF\u30C6\u30A3\u30D6\u306A\u5B9F\u884C\u3092\u518D\u958B\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "La sesi\u00F3n se carg\u00F3, pero no se pudo reanudar la ejecuci\u00F3n activa anterior." }),
      );
    } finally {
      cancelRequestedRef.current = false;
      streamAbortControllerRef.current = null;
      setCurrentRunId(null);
      setCancelingRun(false);
      setRunning(false);
    }
  }

  async function loadSession(id: string) {
    setError("");

    // ── Cache-first: render immediately from localStorage if available ──
    const cached = readSessionCache<LoadedSession>(id);
    if (cached) {
      applySessionToState(cached.data);
      autoResumeSessionIdRef.current = null;
      setNotice(`${t("sessionLoaded")} ${cached.data.title}`);
      void resumeActiveRun(cached.data);

      // Background server sync — updates state and cache if data changed
      fetch(`/api/sessions/${id}`)
        .then((r) => r.json())
        .then((data: { session?: LoadedSession }) => {
          if (data.session) {
            if (!activeRunIdRef.current) {
              applySessionToState(data.session);
            }
            writeSessionCache(id, data.session);
            void resumeActiveRun(data.session);
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
      if (id === autoResumeSessionIdRef.current) {
        autoResumeSessionIdRef.current = null;
        skippedAutoResumeSessionIdRef.current = id;
        const nextSearch = buildWorkbenchSessionSearch(
          window.location.search,
          null,
        );
        const nextUrl = nextSearch
          ? `/app/workbench${nextSearch}`
          : "/app/workbench";
        router.replace(nextUrl, { scroll: false });
        restoreDraftOrDefaultState();
      }
      setError(localize(language, { en: data.error || t("runFailed"), ko: t("runFailed"), ja: data.error || t("runFailed"), es: data.error || t("runFailed") }));
      return;
    }

    applySessionToState(data.session);
    autoResumeSessionIdRef.current = null;
    writeSessionCache(id, data.session);
    setNotice(`${t("sessionLoaded")} ${data.session.title}`);
    void resumeActiveRun(data.session);
  }

  async function resumeLatestActiveSession() {
    const requestId = autoResumeRequestIdRef.current + 1;
    autoResumeRequestIdRef.current = requestId;
    const response = await fetch("/api/sessions", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return false;
    }

    const data = (await response.json().catch(() => ({}))) as {
      sessions?: SessionListEntry[];
    };
    const sessionIdToResume = pickLatestActiveSessionId(data.sessions ?? []);
    if (
      !sessionIdToResume ||
      sessionIdToResume === skippedAutoResumeSessionIdRef.current
    ) {
      return false;
    }

    if (requestId !== autoResumeRequestIdRef.current) {
      return false;
    }

    if (!canAutoResumeFromSearch(window.location.search)) {
      return false;
    }

    autoResumeSessionIdRef.current = sessionIdToResume;
    const nextSearch = buildWorkbenchSessionSearch(
      window.location.search,
      sessionIdToResume,
    );
    const nextUrl = nextSearch ? `/app/workbench${nextSearch}` : "/app/workbench";
    router.replace(nextUrl, { scroll: false });
    return true;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("session");
    const presetId = params.get("preset");
    const projectId = params.get("project");
    const forceNew = params.get("new") === "1";

    loadProviders();
    loadUsageStatus();
    loadPresets(presetId);
    const draft = loadDraft();
    const entryAction = resolveWorkbenchEntryAction({
      loadId,
      projectId,
      forceNew,
      hasDraft: Boolean(draft?.originalInput.trim()),
      latestActiveSessionId: null,
    });
    if (entryAction.kind === "new-session") {
      clearDraft();
      restoreDraftOrDefaultState();
      return;
    }
    if (entryAction.kind === "load-session") {
      void loadSession(entryAction.sessionId);
      return;
    } else if (entryAction.kind === "load-project") {
      void loadProject(entryAction.projectId);
      return;
    } else {
      void resumeLatestActiveSession().then((resumed) => {
        if (!resumed) {
          restoreDraftOrDefaultState();
        }
      });
    }
    // Load URL-provided session or preset once on initial entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!sessionId && searchParams.get("session")) {
      return;
    }

    const nextSearch = buildWorkbenchSessionSearch(
      window.location.search,
      sessionId,
    );
    const nextUrl = `${window.location.pathname}${nextSearch}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [router, searchParams, sessionId]);

  useEffect(() => {
    const stored = readBrowserStorageValueAny([
      PRIMARY_STORAGE_KEYS.resultLayout,
      ...LEGACY_STORAGE_KEYS.resultLayout,
    ]);
    if (stored === "double" || stored === "single") {
      setResultLayout(stored);
    }
  }, []);

  useEffect(() => {
    if (!routeSyncReadyRef.current) {
      routeSyncReadyRef.current = true;
      return;
    }

    const loadId = searchParams.get("session");
    const presetId = searchParams.get("preset");
    const projectId = searchParams.get("project");
    const forceNew = searchParams.get("new") === "1";

    if (presetId) {
      void loadPresets(presetId);
    }

    const draft = loadDraft();
    const entryAction = resolveWorkbenchEntryAction({
      loadId,
      projectId,
      forceNew,
      hasDraft: Boolean(draft?.originalInput.trim()),
      latestActiveSessionId: null,
    });

    if (entryAction.kind === "new-session") {
      clearDraft();
      restoreDraftOrDefaultState();
      return;
    }

    if (entryAction.kind === "load-session") {
      void loadSession(entryAction.sessionId);
      return;
    }

    if (entryAction.kind === "load-project") {
      restoreDraftOrDefaultState();
      void loadProject(entryAction.projectId);
      return;
    }

    void resumeLatestActiveSession().then((resumed) => {
      if (!resumed) {
        restoreDraftOrDefaultState();
      }
    });
    // Keep the workbench in sync with sidebar and in-app query navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let refreshInFlight = false;

    const refreshCurrentWorkbenchState = async (event?: PageTransitionEvent) => {
      if (
        refreshInFlight ||
        !shouldRevalidateWorkbenchOnPageResume({
          activeRunId: activeRunIdRef.current,
          sessionId,
          pagePersisted: event?.persisted,
          visibilityState: document.visibilityState,
        })
      ) {
        return;
      }

      refreshInFlight = true;
      try {
        const runId = activeRunIdRef.current;
        if (runId) {
          const status = await fetchRunStatus(runId);
          if (status?.runSteps?.length) {
            setRunMonitor((current) =>
              buildRunMonitorFromRunSteps({
                runSteps: status.runSteps || [],
                language,
                uiText,
                startedAt: current?.startedAt ?? Date.now(),
              }),
            );
          }

          if (
            status?.status &&
            ["completed", "partial", "failed", "canceled", "cancelled"].includes(
              status.status,
            )
          ) {
            applyCompletedRun(
              {
                session: sessionId
                  ? {
                      id: sessionId,
                      title: sessionTitle,
                      finalResultId: status.finalResultId,
                    }
                  : undefined,
                results: status.results || [],
                executionSummary: status.executionSummary ?? undefined,
                streamError: status.streamError || status.errorMessage || undefined,
              },
              status.mode === "sequential" ? "sequential" : "parallel",
            );
            setCurrentRunId(null);
            setCancelingRun(false);
            setRunning(false);
            void loadUsageStatus({ preferCache: false });
            return;
          }
        }

        if (sessionId && !activeRunIdRef.current) {
          const response = await fetch(`/api/sessions/${sessionId}`, {
            headers: { Accept: "application/json" },
          });
          const data = (await response.json().catch(() => ({}))) as {
            session?: LoadedSession;
          };
          if (response.ok && data.session) {
            applySessionToState(data.session);
            writeSessionCache(sessionId, data.session);
            void resumeActiveRun(data.session);
          }
        }
      } finally {
        refreshInFlight = false;
      }
    };

    const handlePageshow = (event: PageTransitionEvent) => {
      void refreshCurrentWorkbenchState(event);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshCurrentWorkbenchState();
      }
    };

    window.addEventListener("pageshow", handlePageshow);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", handlePageshow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // Re-sync after browser/tab restore using the current run token ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, sessionId, sessionTitle, uiText]);

  useEffect(() => {
    const handleNewWorkbench = () => {
      clearDraft();
      restoreDraftOrDefaultState();
    };

    window.addEventListener(NEW_WORKBENCH_EVENT, handleNewWorkbench);
    return () => window.removeEventListener(NEW_WORKBENCH_EVENT, handleNewWorkbench);
    // Keep this listener aligned with localized defaults and provider normalization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, providers]);

  useEffect(() => {
    writeBrowserStorageValue(PRIMARY_STORAGE_KEYS.resultLayout, resultLayout);
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

    if (mode === "sequential" && activeMobilePanel === "models") {
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
          Boolean(result.outputText?.trim()) &&
          // Generated images cannot be compared as text.
          !isImageDataUrl(result.outputText),
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
        workflowControl: workflowControlToInput(
          normalizeWorkflowControlState(workflowControl, workflowSteps.length),
        ),
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
    workflowControl,
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

  const imageProviders = useMemo(
    () => providers.filter((provider) => (provider.imageModels?.length ?? 0) > 0),
    [providers],
  );

  const selectedImageTargets = useMemo<TargetModelInput[]>(() => {
    return imageProviders.flatMap((provider) => {
      const selection = normalizeImageSelection(
        imageSelections[provider.providerName],
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
  }, [imageProviders, imageSelections]);

  const effectiveMode = imageMode ? "parallel" : mode;
  const effectiveTargets = imageMode ? selectedImageTargets : selectedTargets;

  const normalizedWorkflowControl = useMemo(
    () => normalizeWorkflowControlState(workflowControl, workflowSteps.length),
    [workflowControl, workflowSteps.length],
  );

  useEffect(() => {
    setRepeatCountDraftById((current) => {
      const activeIds = new Set(
        normalizedWorkflowControl.repeatBlocks.map((repeatBlock) => repeatBlock.id),
      );
      let changed = false;
      const next = { ...current };

      Object.keys(next).forEach((repeatBlockId) => {
        if (!activeIds.has(repeatBlockId)) {
          delete next[repeatBlockId];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [normalizedWorkflowControl.repeatBlocks]);

  const estimatedSequentialExecutions = useMemo(
    () =>
      calculateSequentialExecutionCount(
        workflowSteps.length,
        normalizedWorkflowControl,
      ),
    [normalizedWorkflowControl, workflowSteps.length],
  );

  const exceedsSequentialLimit =
    estimatedSequentialExecutions > MAX_TOTAL_SEQUENTIAL_STEPS;

  const runCreditEstimate = useMemo(
    () =>
      estimateWorkbenchRunCredits({
        mode: effectiveMode,
        originalInput,
        additionalInstruction,
        targets: effectiveTargets,
        steps: imageMode ? [] : workflowSteps,
        workflowControl: workflowControlToInput(normalizedWorkflowControl),
      }),
    [
      additionalInstruction,
      effectiveMode,
      effectiveTargets,
      imageMode,
      normalizedWorkflowControl,
      originalInput,
      workflowSteps,
    ],
  );
  const numberLocale = localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" });
  // The server reserves credits against BOTH the total balance and the daily
  // allowance, so a run is only feasible up to the smaller of the two. The UI
  // previously showed only the total balance, which made daily-capped runs look
  // affordable when they were not.
  const bindingAvailableCredits = usage
    ? Math.min(usage.totalCreditsAvailable, usage.totalDailyCreditsAvailable)
    : null;
  const dailyIsBindingCredit = usage
    ? usage.totalDailyCreditsAvailable < usage.totalCreditsAvailable
    : false;
  const projectedCreditsAfterRun =
    bindingAvailableCredits == null
      ? null
      : Math.max(0, bindingAvailableCredits - runCreditEstimate.estimatedCredits);
  const runExceedsAvailableCredits =
    bindingAvailableCredits != null &&
    runCreditEstimate.estimatedCredits > bindingAvailableCredits;

  function addRepeatBlock() {
    setWorkflowControl((current) => {
      if (current.repeatBlocks.length >= MAX_REPEAT_BLOCKS) {
        return current;
      }

      const nextBlock = createRepeatBlock(workflowSteps.length);
      return {
        ...current,
        repeatBlocks: [...current.repeatBlocks, nextBlock],
      };
    });
  }

  function updateRepeatBlock(
    repeatBlockId: string,
    updater: (repeatBlock: RepeatBlockState) => RepeatBlockState,
  ) {
    setWorkflowControl((current) => ({
      ...current,
      repeatBlocks: current.repeatBlocks.map((repeatBlock) =>
        repeatBlock.id === repeatBlockId ? updater(repeatBlock) : repeatBlock,
      ),
    }));
  }

  function deleteRepeatBlock(repeatBlockId: string) {
    setWorkflowControl((current) => ({
      ...current,
      repeatBlocks: current.repeatBlocks.filter(
        (repeatBlock) => repeatBlock.id !== repeatBlockId,
      ),
    }));
  }

  function updateRepeatCountDraft(repeatBlockId: string, rawValue: string) {
    const sanitized = sanitizeRepeatCountDraftInput(rawValue);
    if (sanitized === null) {
      return;
    }

    setRepeatCountDraftById((current) => ({
      ...current,
      [repeatBlockId]: sanitized,
    }));

    if (sanitized === "") {
      return;
    }

    const nextRepeatCount = finalizeRepeatCountDraft(
      sanitized,
      1,
      MAX_TOTAL_SEQUENTIAL_STEPS,
    );

    updateRepeatBlock(repeatBlockId, (current) => ({
      ...current,
      repeatCount: nextRepeatCount,
    }));
  }

  function commitRepeatCountDraft(repeatBlockId: string) {
    const draftValue = repeatCountDraftById[repeatBlockId];
    if (draftValue === undefined) {
      return;
    }

    const nextRepeatCount = finalizeRepeatCountDraft(
      draftValue,
      1,
      MAX_TOTAL_SEQUENTIAL_STEPS,
    );

    updateRepeatBlock(repeatBlockId, (current) => ({
      ...current,
      repeatCount: nextRepeatCount,
    }));

    setRepeatCountDraftById((current) => {
      const next = { ...current };
      delete next[repeatBlockId];
      return next;
    });
  }

  const resultDepths = useMemo(() => buildResultDepthMap(results), [results]);

  const effectiveFinalResultId = useMemo(
    () => pickDisplayFinalResultId(results, finalResultId),
    [finalResultId, results],
  );

  const latestProgressResultId = useMemo(
    () =>
      [...results]
        .reverse()
        .find(
          (result) =>
            (result.status === "running" || result.status === "completed") &&
            result.id !== effectiveFinalResultId,
        )?.id ?? null,
    [effectiveFinalResultId, results],
  );

  const orderedResults = useMemo(
    () => {
      const sortedResults = sortResultsForDisplay(results, mode);
      const pinnedIds = [effectiveFinalResultId, latestProgressResultId];
      return mode === "parallel"
        ? prioritizePinnedRootBranches(sortedResults, pinnedIds)
        : prioritizePinnedResults(sortedResults, pinnedIds);
    },
    [effectiveFinalResultId, latestProgressResultId, mode, results],
  );

  const displayResults = useMemo(
    () =>
      buildResultBoardView(
        orderedResults.map((result) => ({
          ...result,
          searchTokens: [
            result.workflowStep?.orderIndex
              ? `${localize(language, { en: "step", ko: "단계", ja: "\u30B9\u30C6\u30C3\u30D7", es: "paso" })} ${result.workflowStep.orderIndex}`
              : null,
            result.executionRunStep?.orderIndex
              ? `${localize(language, { en: "step", ko: "단계", ja: "\u30B9\u30C6\u30C3\u30D7", es: "paso" })} ${result.executionRunStep.orderIndex}`
              : null,
            result.executionRunStep?.templateStepIndex
              ? `${localize(language, { en: "template", ko: "템플릿", ja: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8", es: "plantilla" })} ${result.executionRunStep.templateStepIndex}`
              : null,
            result.executionRunStep?.actionType ?? null,
            result.executionRunStep?.sourceMode ?? null,
            result.promptSnapshot ?? null,
          ],
        })),
        {
          filter: resultFilter,
          sort: resultSort,
          query: resultSearch,
          finalResultId: effectiveFinalResultId,
        },
      ),
    [effectiveFinalResultId, language, orderedResults, resultFilter, resultSearch, resultSort],
  );

  const displayResultIds = useMemo(
    () => displayResults.map((result) => result.id),
    [displayResults],
  );

  useEffect(() => {
    if (!displayResultIds.length) {
      setActiveResultId(null);
      return;
    }

    let frameId = 0;
    const anchorTop = 96;

    const pickActiveResult = () => {
      frameId = 0;
      let nextActiveId: string | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      const lowerBound = window.innerHeight * 0.82;

      displayResultIds.forEach((resultId) => {
        const element = document.getElementById(buildResultDomId(resultId));
        if (!element) {
          return;
        }

        const rect = element.getBoundingClientRect();
        if (rect.bottom < anchorTop || rect.top > lowerBound) {
          return;
        }

        const distance =
          rect.top <= anchorTop && rect.bottom >= anchorTop
            ? 0
            : Math.abs(rect.top - anchorTop);
        if (distance < bestDistance) {
          bestDistance = distance;
          nextActiveId = resultId;
        }
      });

      setActiveResultId((current) => (current === nextActiveId ? current : nextActiveId));
    };

    const schedulePick = () => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(pickActiveResult);
    };

    schedulePick();
    window.addEventListener("scroll", schedulePick, { passive: true });
    window.addEventListener("resize", schedulePick);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", schedulePick);
      window.removeEventListener("resize", schedulePick);
    };
  }, [displayResultIds]);

  const { mainResults: mainDisplayResults, branchResults: branchDisplayResults } =
    useMemo(() => partitionResultsForWorkbench(displayResults), [displayResults]);

  const finalDisplayResult = useMemo(
    () => results.find((result) => result.id === effectiveFinalResultId) ?? null,
    [effectiveFinalResultId, results],
  );

  const plannedSequentialSteps = useMemo(
    () =>
      mode === "sequential"
        ? expandWorkflowStepsForMonitor(workflowSteps, normalizedWorkflowControl)
        : [],
    [mode, normalizedWorkflowControl, workflowSteps],
  );

  const runSummary = useMemo(() => {
    if (mode === "parallel") {
      const completed = results.filter((result) => result.status === "completed").length;
      const runningCount = results.filter((result) => result.status === "running").length;
      return {
        title:
          localize(language, { en: "Parallel run summary", ko: "병렬 실행 요약", ja: "\u4E26\u5217\u5B9F\u884C\u306E\u6982\u8981", es: "Resumen de ejecuci\u00F3n paralela" }),
        detail:
          localize(language, { en: `${completed} completed, ${runningCount} running`, ko: `${completed}개 완료, ${runningCount}개 진행 중`, ja: `${completed}\u5B8C\u6210\u3057\u305F\u3001${runningCount}\u8D70\u3063\u3066\u3044\u308B`, es: `${completed}terminado,${runningCount}correr` }),
      };
    }

    const total = plannedSequentialSteps.length;
    const completed = runMonitor?.entries.filter((entry) => entry.status === "completed")
      .length;
    const activeEntry = runMonitor?.entries.find((entry) => entry.status === "active");
    const queued = runMonitor?.entries.filter((entry) => entry.status === "queued").length;

    return {
      title:
        localize(language, { en: "Current run summary", ko: "현재 작업 요약", ja: "\u73FE\u5728\u306E\u5B9F\u884C\u306E\u6982\u8981", es: "Resumen de ejecuci\u00F3n actual" }),
      detail:
        localize(language, { en: `${completed ?? 0} of ${total} steps done${activeEntry?.orderIndex ? ` · step ${activeEntry.orderIndex} now` : ""}${queued ? ` · ${queued} queued` : ""}`, ko: `총 ${total}단계 중 ${completed ?? 0}단계 완료${activeEntry?.orderIndex ? ` · 현재 ${activeEntry.orderIndex}단계` : ""}${queued ? ` · 대기 ${queued}단계` : ""}`, ja: `${completed ?? 0}\u306E${total}\u5B8C\u4E86\u3057\u305F\u624B\u9806${activeEntry?.orderIndex ? `\u30FB \u30B9\u30C6\u30C3\u30D7${activeEntry.orderIndex}\u4ECA` : ""}${queued ? ` \u00B7 ${queued}\u5217\u306B\u4E26\u3093\u3060` : ""}`, es: `${completed ?? 0}de${total}pasos realizados${activeEntry?.orderIndex ? `\u00B7 paso${activeEntry.orderIndex}ahora` : ""}${queued ? ` \u00B7 ${queued}en cola` : ""}` }),
    };
  }, [language, mode, plannedSequentialSteps.length, results, runMonitor]);

  useEffect(() => {
    setResultExpansionById({});
  }, [sessionId]);

  useEffect(() => {
    setResultExpansionById((current) => mergeResultExpansionMap(current, results));
  }, [results]);

  const hasExpandedResults = useMemo(
    () => displayResults.some((result) => resultExpansionById[result.id]),
    [displayResults, resultExpansionById],
  );

  const hasCollapsedResults = useMemo(
    () => displayResults.some((result) => !resultExpansionById[result.id]),
    [displayResults, resultExpansionById],
  );

  const progressResultIdsByOrderIndex = useMemo(() => {
    const map = new Map<number, string>();

    results.forEach((result) => {
      const orderIndex = result.executionRunStep?.orderIndex;
      if (!orderIndex) {
        return;
      }

      const existingId = map.get(orderIndex);
      if (!existingId) {
        map.set(orderIndex, result.id);
        return;
      }

      const existing = results.find((item) => item.id === existingId);
      if (!existing || resultUpdatedAtMs(result) >= resultUpdatedAtMs(existing)) {
        map.set(orderIndex, result.id);
      }
    });

    return map;
  }, [results]);

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
          Boolean(result.outputText?.trim()) &&
          // Generated images cannot be compared as text.
          !isImageDataUrl(result.outputText),
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

  const showInlineParallelComparisonBody =
    !parallelComparisonPanel.collapsed && !parallelComparisonPanel.detached;

  function renderParallelComparisonSummaryBody() {
    if (parallelComparison.status === "loading") {
      return (
        <p className="flex items-center gap-2 text-sm leading-6 text-stone-700">
          <span
            aria-hidden="true"
            className="inline-block animate-[spin_1.2s_linear_infinite]"
          >
            ⏳
          </span>
          {uiText.compareLoading}
        </p>
      );
    }

    if (parallelComparison.status === "completed") {
      return (
        <p className="whitespace-pre-wrap text-sm leading-7 text-stone-800">
          {parallelComparison.comparison.summary}
        </p>
      );
    }

    if (parallelComparison.status === "failed") {
      return (
        <p className="text-sm leading-6 text-rose-700">
          {parallelComparison.error || uiText.compareFailed}
        </p>
      );
    }

    return (
      <p className="text-sm leading-6 text-stone-500">
        {uiText.compareEmpty}
      </p>
    );
  }

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
        results.find((result) => result.id === effectiveFinalResultId)?.provider ??
        uiText.finalPending,
    }),
    [effectiveFinalResultId, results, runMonitor, uiText.finalPending],
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
        elapsed < 2500 && (!entry.detail || entry.detail === uiText.preparing)
          ? uiText.preparing
          : entry.detail || uiText.running;

      return {
        ...entry,
        detail,
        workLines: workLines ?? entry.workLines,
      };
    });
  }, [language, progressNow, runMonitor, uiText.preparing, uiText.running]);

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
            localize(language, { en: "Improve the previous step.", ko: "\uc774\uc804 \ub2e8\uacc4\ub97c \uac1c\uc120\ud558\uc138\uc694.", ja: "\u524D\u306E\u30B9\u30C6\u30C3\u30D7\u3092\u6539\u5584\u3057\u307E\u3059\u3002", es: "Mejora el paso anterior." }),
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
        localize(language, { en: `You can attach up to ${MAX_ATTACHMENTS_PER_RUN} files.`, ko: `파일은 최대 ${MAX_ATTACHMENTS_PER_RUN}개까지 첨부할 수 있습니다.`, ja: `\u307E\u3067\u6DFB\u4ED8\u3067\u304D\u307E\u3059${MAX_ATTACHMENTS_PER_RUN}\u30D5\u30A1\u30A4\u30EB\u3002`, es: `Puedes adjuntar hasta${MAX_ATTACHMENTS_PER_RUN}archivos.` }),
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
        localize(language, { en: `Attached ${uploaded.length} file(s).`, ko: `${uploaded.length}개 파일을 첨부했습니다.`, ja: `\u6DFB\u4ED8${uploaded.length}\u30D5\u30A1\u30A4\u30EB\u3002`, es: `Adjunto${uploaded.length}archivo(s).` }),
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

  async function fetchRunStatus(runId: string) {
    const response = await fetch(`/api/workbench/runs/${runId}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json().catch(() => null)) as RunStatusSnapshot | null;
  }

  async function readRunStream(
    runId: string,
    seedResults: WorkbenchResult[] = [],
  ) {
    const streamAbortController = new AbortController();
    streamAbortControllerRef.current = streamAbortController;
    let cursor = 0;
    let reconnectAttempts = 0;
    let donePayload: Extract<WorkbenchRunStreamEvent, { type: "done" }> | null =
      null;
    let streamError = "";
    let receivedResults = 0;
    let latestSession:
      | { id: string; title: string; finalResultId?: string | null }
      | null = null;
    const knownResultsById = new Map(
      seedResults.map((result) => [result.id, result]),
    );
    const streamedResults: WorkbenchResult[] = [];

    const handleEvent = (event: WorkbenchRunStreamEvent) => {
      if (cancelRequestedRef.current || streamAbortController.signal.aborted) {
        return;
      }

      if (event.type === "session") {
        latestSession = event.session;
        setSessionId(event.session.id);
        setSessionTitle(event.session.title);
        setFinalResultId(event.session.finalResultId || null);
        return;
      }

      if (event.type === "run_plan") {
        setFinalResultId(event.executionRun.finalResultId || null);
        setRunMonitor((current) => {
          const startedAt = current?.startedAt ?? Date.now();
          return buildRunMonitorFromRunSteps({
            runSteps: event.runSteps,
            language,
            uiText,
            startedAt,
          });
        });
        return;
      }

      if (event.type === "progress") {
        updateProgressEntry({
          index: event.index,
          status: event.status || "active",
          title: event.title,
          subtitle:
            event.actionType && mode === "sequential"
              ? `${uiText.sequentialStep} ${event.index + 1} - ${getActionTypeDisplayLabel(
                  event.actionType,
                  language,
                )}`
              : event.subtitle,
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
        const existingStreamedResult = knownResultsById.get(event.result.id);
        const preferredResult = pickPreferredResult(
          existingStreamedResult,
          event.result,
        );
        const staleResultEvent = preferredResult !== event.result;
        if (staleResultEvent) {
          return;
        }

        knownResultsById.set(preferredResult.id, preferredResult);
        setResults((current) => mergeResults(current, [preferredResult]));

        if (event.result.status === "running") {
          updateProgressEntry({
            index: event.index,
            status: "active",
            detail: uiText.running,
            workLines: buildWorkLines({
              language,
              primary: uiText.running,
              secondary: compactPreview(
                event.result.promptSnapshot,
                event.result.provider,
              ),
            }),
          });
          return;
        }

        receivedResults += 1;
        const existingIndex = streamedResults.findIndex(
          (result) => result.id === preferredResult.id,
        );
        if (existingIndex >= 0) {
          streamedResults[existingIndex] = preferredResult;
        } else {
          streamedResults.push(preferredResult);
        }
        const progressStatus = resultProgressStatus(preferredResult);
        updateProgressEntry({
          index: event.index,
          status: progressStatus,
          detail:
            progressStatus === "failed"
              ? preferredResult.errorMessage || uiText.failed
              : progressStatus === "canceled"
                ? preferredResult.errorMessage || uiText.stepStopped
                : progressStatus === "skipped"
                  ? uiText.skipped
                  : uiText.completed,
          workLines: buildWorkLines({
            language,
            primary:
              progressStatus === "failed"
                ? uiText.failed
                : progressStatus === "canceled"
                  ? uiText.stepStopped
                  : progressStatus === "skipped"
                    ? uiText.skipped
                    : uiText.completed,
            secondary: compactPreview(
              preferredResult.outputText || preferredResult.errorMessage,
              preferredResult.provider,
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

    const parseStreamEvent = (line: string) => {
      try {
        return JSON.parse(line) as WorkbenchRunStreamEvent;
      } catch (parseError) {
        const message =
          parseError instanceof Error ? parseError.message : String(parseError);
        if (/unexpected\s+(end|eof)|unterminated/i.test(message)) {
          return null;
        }
        throw parseError;
      }
    };

    while (true) {
      const streamUrl =
        cursor > 0
          ? `/api/workbench/runs/${runId}/stream?startIndex=${cursor}`
          : `/api/workbench/runs/${runId}/stream`;
      const response = await fetch(streamUrl, {
        signal: streamAbortController.signal,
        headers: {
          Accept: "application/x-ndjson",
        },
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/x-ndjson")) {
        const errorPayload = (await response.json().catch(() => ({}))) as
          UsageErrorPayload & {
            error?: string;
            status?: string;
          };

        if (errorPayload.redirectUrl) {
          window.location.href = errorPayload.redirectUrl;
          return null;
        }

        if (response.status === 409 && errorPayload.status === "queued") {
          await new Promise((resolve) =>
            window.setTimeout(
              resolve,
              getRunStreamRetryDelayMs(reconnectAttempts),
            ),
          );
          reconnectAttempts += 1;
          continue;
        }

        if (errorPayload.usage) {
          setUsage(errorPayload.usage);
          writeUsageCache(errorPayload.usage);
        }

        throw new Error(errorPayload.error || t("runFailed"));
      }

      if (!response.body) {
        return null;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          const event = parseStreamEvent(line);
          if (event) {
            handleEvent(event);
            cursor += 1;
            reconnectAttempts = 0;
          }
        }

        if (done) {
          break;
        }
      }

      if (buffer.trim()) {
        const event = parseStreamEvent(buffer);
        if (event) {
          handleEvent(event);
          cursor += 1;
        }
      }

      if (donePayload) {
        break;
      }

      const status = await fetchRunStatus(runId);
      if (status?.runSteps?.length) {
        setRunMonitor((current) =>
          buildRunMonitorFromRunSteps({
            runSteps: status.runSteps || [],
            language,
            uiText,
            startedAt: current?.startedAt ?? Date.now(),
          }),
        );
      }
      if (status?.status === "canceled" || status?.status === "cancelled") {
        return {
          type: "done",
          session: latestSession ?? undefined,
          results: status.results?.length ? status.results : streamedResults,
          executionSummary:
            status.executionSummary ?? {
              plannedTotal: runMonitor?.entries.length ?? streamedResults.length,
              executedTotal: streamedResults.length,
              stoppedEarly: true,
              stopReason: "canceled",
            },
        } as Extract<WorkbenchRunStreamEvent, { type: "done" }>;
      }
      if (
        status?.status &&
        !["completed", "partial", "failed", "canceled", "cancelled"].includes(
          status.status,
        )
      ) {
        await new Promise((resolve) =>
          window.setTimeout(
            resolve,
            getRunStreamRetryDelayMs(reconnectAttempts),
          ),
        );
        reconnectAttempts += 1;
        continue;
      }

      if (
        !streamError &&
        status?.status !== "canceled" &&
        status?.status !== "cancelled"
      ) {
        streamError = status?.streamError || status?.errorMessage || "";
      }
      break;
    }

    const terminalStatus = await fetchRunStatus(runId);
    if (
      !donePayload &&
      terminalStatus?.results?.length &&
      ["completed", "partial", "failed", "canceled", "cancelled"].includes(
        terminalStatus.status || "",
      )
    ) {
      const resolvedSession = latestSession
        ? {
            id: (latestSession as { id: string }).id,
            title: (latestSession as { title: string }).title,
            finalResultId:
              terminalStatus.finalResultId ??
              (latestSession as { finalResultId?: string | null }).finalResultId,
          }
        : undefined;
      return {
        type: "done",
        session: resolvedSession,
        results: terminalStatus.results,
        streamError: terminalStatus.streamError || terminalStatus.errorMessage || undefined,
        executionSummary: terminalStatus.executionSummary,
      } as Extract<WorkbenchRunStreamEvent, { type: "done" }>;
    }

    if (streamError && !donePayload && receivedResults === 0) {
      throw new Error(streamError);
    }

    return (
      donePayload ??
      (latestSession
        ? ({
            type: "done",
            session: latestSession,
            results: streamedResults,
            streamError,
          } as Extract<WorkbenchRunStreamEvent, { type: "done" }>)
        : null)
    );
  }

  function applyCompletedRun(
    data: {
      session?: { id: string; title: string; finalResultId?: string | null };
      results?: WorkbenchResult[];
      executionSummary?: {
        plannedTotal: number;
        executedTotal: number;
        stoppedEarly: boolean;
        stopReason?: string | null;
      };
      streamError?: string;
      usage?: UsageStatusType;
    },
    modeToRun: "parallel" | "sequential",
  ) {
    if (!data.session) {
      if (data.executionSummary?.stopReason === "canceled") {
        finalizeRunMonitor({
          mode: modeToRun,
          results: data.results || [],
          executionSummary: data.executionSummary,
          streamError: data.streamError,
        });
        setNotice(uiText.canceled);
        setStoppingStepIndexes(new Set<number>());
        return;
      }
      setError(t("runFailed"));
      return;
    }

    setSessionId(data.session.id);
    setSessionTitle(data.session.title);
    setFinalResultId(data.session.finalResultId || null);
    if (data.usage) {
      setUsage(data.usage);
      writeUsageCache(data.usage);
    } else {
      void loadUsageStatus({ preferCache: false });
    }
    setResults((current) => mergeResults(current, data.results || []));
    setActiveMobilePanel("results");
    setStoppingStepIndexes(new Set<number>());
    clearDraft();
    setDraftBanner(null);
    finalizeRunMonitor({
      mode: modeToRun,
      results: data.results || [],
      executionSummary: data.executionSummary,
      streamError: data.streamError,
    });
    router.refresh();
    const completionNotice =
      data.streamError || data.results?.some((result) => result.status === "failed")
        ? t("runCompletedPartial")
        : t("runCompleted");
    if (data.executionSummary?.stopReason === "canceled") {
      setNotice(uiText.canceled);
      return;
    }
    if (modeToRun === "sequential" && data.executionSummary?.stoppedEarly) {
      setNotice(
        `${completionNotice} (${data.executionSummary.executedTotal}/${data.executionSummary.plannedTotal})`,
      );
      return;
    }
    setNotice(
      data.streamError && completionNotice === t("runCompletedPartial")
        ? localize(language, { en: `${completionNotice} Check the failed result cards.`, ko: `${completionNotice} 실패 카드를 확인하세요.`, ja: `${completionNotice}\u5931\u6557\u3057\u305F\u7D50\u679C\u30AB\u30FC\u30C9\u3092\u78BA\u8A8D\u3057\u307E\u3059\u3002`, es: `${completionNotice}Verifique las tarjetas de resultados fallidos.` })
        : completionNotice,
    );
  }

  async function stopActiveRun() {
    const runId = activeRunIdRef.current;
    if (!runId || runId === "pending" || cancelingRun) {
      return;
    }

    setCancelingRun(true);
    setNotice(
      localize(language, { en: "Requesting stop...", ko: "\uc804\uccb4 \uc911\uc9c0\ub97c \uc694\uccad\ud558\ub294 \uc911\uc785\ub2c8\ub2e4.", ja: "\u505C\u6B62\u3092\u8981\u6C42\u4E2D...", es: "Solicitando parada..." }),
    );
    setError("");

    try {
      const response = await fetch(
        `/api/workbench/runs/${encodeURIComponent(runId)}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || t("runFailed"));
        setNotice("");
        setCancelingRun(false);
        return;
      }
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : t("runFailed"));
      setNotice("");
      setCancelingRun(false);
      return;
    }

    setNotice(uiText.canceled);
    setRunMonitor((current) =>
      current
        ? {
            ...current,
            entries: current.entries.map((entry) =>
              entry.status === "active" || entry.status === "queued"
                ? {
                    ...entry,
                    status: "canceled" as const,
                    detail: uiText.canceled,
                  }
                : entry,
            ),
          }
        : current,
    );
    setStoppingStepIndexes(new Set<number>());
  }

  async function stopRunStep(index: number) {
    const runId = activeRunIdRef.current;
    if (!runId || runId === "pending" || cancelingRun || stoppingStepIndexes.has(index)) {
      return;
    }

    const currentEntry = runMonitor?.entries[index];
    if (!currentEntry?.canStop) {
      return;
    }

    const previousEntry = currentEntry;
    setStoppingStepIndexes((current) => new Set([...current, index]));
    setError("");
    updateProgressEntry({
      index,
      status: runMonitor?.entries[index]?.status === "queued" ? "skipped" : "canceled",
      detail: uiText.stepStopRequested,
      workLines: buildWorkLines({
        language,
        primary: uiText.stepStopRequested,
        secondary: uiText.stepStopRequested,
      }),
    });

    try {
      const response = await fetch(
        `/api/workbench/runs/${encodeURIComponent(runId)}/steps/${index}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        restoreProgressEntry(index, previousEntry);
        setError(data.error || t("runFailed"));
      }
    } catch (stepStopError) {
      restoreProgressEntry(index, previousEntry);
      setError(
        stepStopError instanceof Error ? stepStopError.message : t("runFailed"),
      );
    } finally {
      setStoppingStepIndexes((current) => {
        const next = new Set(current);
        next.delete(index);
        return next;
      });
    }
  }

  async function runWorkbench() {
    if (running || activeRunIdRef.current) {
      return;
    }

    setError("");
    setNotice("");

    if (!originalInput.trim()) {
      setError(t("taskRequired"));
      return;
    }

    if (imageMode && !selectedImageTargets.length) {
      setError(
        localize(language, { en: "Select at least one image generation model.", ko: "이미지 생성 모델을 한 개 이상 선택하세요.", ja: "\u5C11\u306A\u304F\u3068\u3082 1 \u3064\u306E\u30A4\u30E1\u30FC\u30B8\u751F\u6210\u30E2\u30C7\u30EB\u3092\u9078\u629E\u3057\u307E\u3059\u3002", es: "Seleccione al menos un modelo de generaci\u00F3n de im\u00E1genes." }),
      );
      return;
    }

    if (!imageMode && mode === "parallel" && !selectedTargets.length) {
      setError(t("enableProviderShort"));
      return;
    }

    if (!imageMode && mode === "sequential" && !workflowSteps.length) {
      setError(builderText.minimumStepNotice);
      return;
    }

    if (!imageMode && mode === "sequential" && exceedsSequentialLimit) {
      setError(builderText.totalLimitNotice);
      return;
    }

    if (uploadingAttachments) {
      setError(t("uploading"));
      return;
    }

    // Block runs the server would reject for credits up front, with a message
    // that names the binding constraint (daily allowance vs total balance) so a
    // user with enough total credits understands why a daily-capped run fails.
    if (runExceedsAvailableCredits && usage) {
      setError(
        dailyIsBindingCredit
          ? localize(language, { en: `This run needs about ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} credits, but only ${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)} of your daily ${usage.dailyCreditLimit.toLocaleString(numberLocale)} remain today. Select fewer models or try again after the midnight (KST) reset.`, ko: `이 실행에는 약 ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} 크레딧이 필요하지만 오늘 남은 크레딧은 ${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}개입니다(일일 한도 ${usage.dailyCreditLimit.toLocaleString(numberLocale)}). 선택한 모델 수를 줄이거나 자정(KST) 초기화 후 다시 시도하세요.`, ja: `\u3053\u306E\u5B9F\u884C\u306B\u306F\u7D04${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}\u30AF\u30EC\u30B8\u30C3\u30C8\u3067\u3059\u304C\u3001${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}\u3042\u306A\u305F\u306E\u6BCE\u65E5\u306E${usage.dailyCreditLimit.toLocaleString(numberLocale)}\u4ECA\u65E5\u3082\u6B8B\u308A\u307E\u3059\u3002\u9078\u629E\u3059\u308B\u30E2\u30C7\u30EB\u3092\u6E1B\u3089\u3059\u304B\u3001\u5348\u524D 0 \u6642 (KST) \u306E\u30EA\u30BB\u30C3\u30C8\u5F8C\u306B\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002`, es: `Esta carrera necesita aproximadamente${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}cr\u00E9ditos, pero s\u00F3lo${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}de tu diario${usage.dailyCreditLimit.toLocaleString(numberLocale)}permanecen hoy. Seleccione menos modelos o int\u00E9ntelo nuevamente despu\u00E9s del reinicio de medianoche (KST).` })
          : localize(language, { en: `This run needs about ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} credits, but only ${usage.totalCreditsAvailable.toLocaleString(numberLocale)} are available. Select fewer models.`, ko: `이 실행에는 약 ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} 크레딧이 필요하지만 보유 크레딧은 ${usage.totalCreditsAvailable.toLocaleString(numberLocale)}개입니다. 선택한 모델 수를 줄여 주세요.`, ja: `\u3053\u306E\u5B9F\u884C\u306B\u306F\u7D04${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}\u30AF\u30EC\u30B8\u30C3\u30C8\u3067\u3059\u304C\u3001${usage.totalCreditsAvailable.toLocaleString(numberLocale)}\u5229\u7528\u53EF\u80FD\u3067\u3059\u3002\u9078\u629E\u3059\u308B\u30E2\u30C7\u30EB\u3092\u6E1B\u3089\u3057\u307E\u3059\u3002`, es: `Esta carrera necesita aproximadamente${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}cr\u00E9ditos, pero s\u00F3lo${usage.totalCreditsAvailable.toLocaleString(numberLocale)}est\u00E1n disponibles. Seleccione menos modelos.` }),
      );
      focusCreditWarning();
      return;
    }

    setProgressNow(Date.now());
    setStoppingStepIndexes(new Set<number>());
    resetResultBoardControls();
    setRunMonitor(createRunMonitor(effectiveMode));
    focusProgressPanel();
    if (effectiveMode === "parallel") {
      setParallelComparison({ signature: "", status: "idle" });
    }
    setCurrentRunId("pending");
    setRunning(true);
    const body = buildWorkbenchRunPayload({
      sessionId,
      projectId: project?.id ?? null,
      title: sessionTitle || null,
      originalInput,
      additionalInstruction,
      outputStyle,
      outputLanguage,
      attachments,
      mode: effectiveMode,
      targets: effectiveTargets,
      workflowSteps: imageMode ? [] : workflowSteps,
      workflowControl: workflowControlToInput(normalizedWorkflowControl),
    });
    let data: ({
      session?: { id: string; title: string; finalResultId?: string | null };
      results?: WorkbenchResult[];
      executionSummary?: {
        plannedTotal: number;
        executedTotal: number;
        stoppedEarly: boolean;
        stopReason?: string | null;
      };
      streamError?: string;
      usage?: UsageStatusType;
    } & UsageErrorPayload) = {};

    try {
      const response = await fetch("/api/workbench/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      const kickoff = (await response.json().catch(() => ({}))) as UsageErrorPayload & {
        error?: string;
        runId?: string;
      };

      if (handleAuthRedirect(response, kickoff)) {
        return;
      }

      if (handleUsageError(kickoff)) {
        setError(kickoff.error || t("runFailed"));
        return;
      }

      if (!response.ok || !kickoff.runId) {
        setRunMonitor((current) =>
          current
            ? {
                ...current,
                entries: current.entries.map((entry) => ({
                  ...entry,
                  status: "failed",
                  detail: kickoff.error || uiText.failed,
                })),
              }
            : current,
        );
        setError(kickoff.error || t("runFailed"));
        return;
      }

      setCurrentRunId(kickoff.runId);
      const streamed = await readRunStream(kickoff.runId);
      if (cancelRequestedRef.current) {
        return;
      }
      data = streamed || {};

      if (
        !response.ok ||
        (!data.session && data.executionSummary?.stopReason !== "canceled")
      ) {
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

      applyCompletedRun(data, mode);
    } catch (runError) {
      if (cancelRequestedRef.current) {
        setNotice(uiText.canceled);
      } else {
        setError(runError instanceof Error ? runError.message : t("runFailed"));
      }
    } finally {
      cancelRequestedRef.current = false;
      streamAbortControllerRef.current = null;
      setCurrentRunId(null);
      setCancelingRun(false);
      setStoppingStepIndexes(new Set<number>());
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
        localize(language, { en: data.error || t("branchRunFailed"), ko: t("branchRunFailed"), ja: data.error || t("branchRunFailed"), es: data.error || t("branchRunFailed") }),
      );
      return;
    }

    if (data.usage) {
      setUsage(data.usage);
      writeUsageCache(data.usage);
    }
    setResults((current) => mergeResults(current, data.results || []));
    setActiveMobilePanel("results");
    router.refresh();
    setNotice(t("branchAdded"));
  }

  async function rerunResult(resultId: string) {
    setError("");
    const response = await fetch(`/api/results/${resultId}/rerun`, {
      method: "POST",
    });
    const data = (await response.json().catch(() => ({}))) as {
      result?: WorkbenchResult;
      runId?: string;
      usage?: UsageStatusType;
    } & UsageErrorPayload;

    if (handleAuthRedirect(response, data)) {
      return;
    }

    if (handleUsageError(data)) {
      setError(data.error || t("rerunFailed"));
      return;
    }

    if (!response.ok || (!data.result && !data.runId)) {
      setError(
        data.error || t("rerunFailed"),
      );
      return;
    }

    if (data.usage) {
      setUsage(data.usage);
      writeUsageCache(data.usage);
    }
    if (data.runId) {
      setProgressNow(Date.now());
      setRunMonitor(null);
      focusProgressPanel();
      setCurrentRunId(data.runId);
      setRunning(true);
      try {
        const streamed = await readRunStream(data.runId, results);
        if (streamed) {
          applyCompletedRun(streamed, "sequential");
        }
      } finally {
        cancelRequestedRef.current = false;
        streamAbortControllerRef.current = null;
        setCurrentRunId(null);
        setCancelingRun(false);
        setStoppingStepIndexes(new Set<number>());
        setRunning(false);
      }
      router.refresh();
      setNotice(t("rerunAdded"));
      return;
    }

    const rerun = data.result!;
    setResults((current) => mergeResults(current, [rerun]));
    setActiveMobilePanel("results");
    router.refresh();
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
        localize(language, { en: data.error || t("deleteFailed"), ko: t("deleteFailed"), ja: data.error || t("deleteFailed"), es: data.error || t("deleteFailed") }),
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

  async function createSharedLink(resultId?: string): Promise<ShareLinkOutcome | null> {
    if (!sessionId) {
      throw new Error(
        localize(language, { en: "There is no saved session to share yet.", ko: "공유할 저장 세션이 아직 없습니다.", ja: "\u5171\u6709\u3067\u304D\u308B\u4FDD\u5B58\u6E08\u307F\u30BB\u30C3\u30B7\u30E7\u30F3\u306F\u307E\u3060\u3042\u308A\u307E\u305B\u3093\u3002", es: "A\u00FAn no hay ninguna sesi\u00F3n guardada para compartir." }),
      );
    }

    const response = await fetch(`/api/sessions/${sessionId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resultId ? { resultId } : {}),
    });
    const data = (await response.json().catch(() => ({}))) as {
      sessionPath?: string;
      resultPath?: string | null;
      error?: string;
      redirectUrl?: string;
    };

    if (handleAuthRedirect(response, data)) {
      return null;
    }

    if (!response.ok || !data.sessionPath) {
      throw new Error(
        data.error ||
          (localize(language, { en: "Could not create the share link.", ko: "공유 링크를 만들지 못했습니다.", ja: "\u5171\u6709\u30EA\u30F3\u30AF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo crear el enlace para compartir." })),
      );
    }

    const path = resultId ? data.resultPath || data.sessionPath : data.sessionPath;
    const shareUrl = new URL(path, window.location.origin).toString();
    const copyResult = await copyTextToClipboard(shareUrl);
    return { url: shareUrl, copied: copyResult.copied };
  }

  async function shareSessionOverview() {
    setError("");
    setSharingSession(true);
    try {
      const outcome = await createSharedLink();
      if (!outcome) {
        return;
      }

      setSessionShareUrl(outcome.url);
      setSessionShareCopyBlocked(!outcome.copied);
      setSessionShareCopied(outcome.copied);
      setNotice(
        outcome.copied
          ? localize(language, { en: "Copied the full shared-view link.", ko: "전체 공유 링크를 복사했습니다.", ja: "\u5B8C\u5168\u306A\u5171\u6709\u30D3\u30E5\u30FC \u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002", es: "Copi\u00E9 el enlace completo de vista compartida." })
          : localize(language, { en: "The link was created, but the browser blocked automatic copying. Open it below or select it manually.", ko: "링크는 생성됐지만 브라우저가 자동 복사를 막았습니다. 아래 링크를 직접 열거나 선택해서 복사하세요.", ja: "\u30EA\u30F3\u30AF\u306F\u4F5C\u6210\u3055\u308C\u307E\u3057\u305F\u304C\u3001\u30D6\u30E9\u30A6\u30B6\u306B\u3088\u3063\u3066\u81EA\u52D5\u30B3\u30D4\u30FC\u304C\u30D6\u30ED\u30C3\u30AF\u3055\u308C\u307E\u3057\u305F\u3002\u4EE5\u4E0B\u3067\u958B\u304F\u304B\u3001\u624B\u52D5\u3067\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "El enlace fue creado, pero el navegador bloque\u00F3 la copia autom\u00E1tica. \u00C1bralo a continuaci\u00F3n o selecci\u00F3nelo manualmente." }),
      );
      if (outcome.copied) {
        window.setTimeout(() => setSessionShareCopied(false), 1200);
      }
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : localize(language, { en: "Could not create the share link.", ko: "공유 링크를 만들지 못했습니다.", ja: "\u5171\u6709\u30EA\u30F3\u30AF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo crear el enlace para compartir." }),
      );
    } finally {
      setSharingSession(false);
    }
  }

  async function copyOriginalInputText() {
    const outcome = await copyTextToClipboard(originalInput);
    setNotice(
      buildSessionInputCopyNotice({
        language,
        copied: outcome.copied,
      }),
    );
    if (outcome.copied) {
      setInputCopied(true);
      setTimeout(() => setInputCopied(false), 1500);
    }
  }

  async function shareResultLink(resultId: string) {
    setError("");
    try {
      const outcome = await createSharedLink(resultId);
      if (!outcome) {
        throw new Error(
          localize(language, { en: "Could not create the share link.", ko: "공유 링크를 만들지 못했습니다.", ja: "\u5171\u6709\u30EA\u30F3\u30AF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo crear el enlace para compartir." }),
        );
      }
      return outcome;
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : localize(language, { en: "Could not create the share link.", ko: "공유 링크를 만들지 못했습니다.", ja: "\u5171\u6709\u30EA\u30F3\u30AF\u3092\u4F5C\u6210\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002", es: "No se pudo crear el enlace para compartir." }),
      );
      throw shareError;
    }
  }

  async function savePreset() {
    if (savingPreset) return;
    setSavingPreset(true);
    try {
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
        workflowControl: workflowControlToInput(normalizedWorkflowControl),
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
        setError(localize(language, { en: data.error || t("runFailed"), ko: t("runFailed"), ja: data.error || t("runFailed"), es: data.error || t("runFailed") }));
        return;
      }

      const savedPreset = data.preset;
      setPresets((current) => [savedPreset, ...current]);
      setNotice(t("workflowPresetSaved"));
      setPresetSavedAt(Date.now());
      setTimeout(() => setPresetSavedAt(null), 2000);
    } finally {
      setSavingPreset(false);
    }
  }

  function loadPreset(id: string) {
    const preset = presets.find((item) => item.id === id);
    if (!preset) {
      return;
    }
    applyPreset(preset);
  }

  const mobilePanels = buildWorkbenchMobilePanels({
    mode,
    resultsCount: results.length,
  }).map((panel) => ({
    id: panel.id as MobilePanel,
    label:
      panel.id === "models"
        ? t("mobileModels")
        : panel.id === "workflow"
          ? t("mobileWorkflow")
          : panel.id === "results"
            ? results.length
              ? `${t("mobileResults")} (${results.length})`
              : t("mobileResults")
            : t("mobileInput"),
  }));

  const mobilePanelClass = (panel: MobilePanel) =>
    activeMobilePanel === panel ? "block" : "hidden xl:block";

  const middlePanelClass =
    activeMobilePanel === "input" || activeMobilePanel === "workflow"
      ? "block"
      : "hidden xl:block";

  const resultStartTargetId = resolveResultStartTarget({
    activeResultId,
    visibleResultIds: displayResultIds,
  });
  const showResultScrollControls = displayResultIds.length > 0;
  const runButtonClassName =
    "w-full rounded-lg bg-sky-500 px-7 py-4 !text-lg !font-extrabold text-white shadow-lg shadow-sky-200/70 ring-2 ring-sky-200 transition hover:bg-sky-600 hover:shadow-xl hover:shadow-sky-300/60 focus:outline-none focus:ring-4 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-sky-300 disabled:shadow-none sm:w-auto sm:min-w-36";

  function jumpToCurrentResultStart() {
    if (!resultStartTargetId) {
      return;
    }

    jumpToResult(resultStartTargetId);
  }

  function jumpToProgressStart() {
    focusProgressPanel();
  }

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
                {localize(language, { en: "Trial Mode (signed out)", ko: "체험 모드 (비로그인)", ja: "\u30C8\u30E9\u30A4\u30A2\u30EB\u30E2\u30FC\u30C9 (\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8)", es: "Modo de prueba (desconectado)" })}
              </p>
              <p className="text-sm text-blue-800">
                {localize(language, { en: "Signed-out visitors get 30 credits per day. Sign in to get 70 credits per day.", ko: "비로그인 사용자는 하루 30크레딧을 사용할 수 있습니다. 로그인하면 하루 70크레딧이 적용됩니다.", ja: "\u30B5\u30A4\u30F3\u30A2\u30A6\u30C8\u3057\u305F\u8A2A\u554F\u8005\u306F 1 \u65E5\u3042\u305F\u308A 30 \u30AF\u30EC\u30B8\u30C3\u30C8\u3092\u53D6\u5F97\u3057\u307E\u3059\u3002\u30B5\u30A4\u30F3\u30A4\u30F3\u3059\u308B\u3068\u30011 \u65E5\u3042\u305F\u308A 70 \u30AF\u30EC\u30B8\u30C3\u30C8\u3092\u7372\u5F97\u3067\u304D\u307E\u3059\u3002", es: "Los visitantes que hayan iniciado sesi\u00F3n obtienen 30 cr\u00E9ditos por d\u00EDa. Inicia sesi\u00F3n para obtener 70 cr\u00E9ditos por d\u00EDa." })}
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

      {usage ? <UsageStatus usage={usage} compact /> : null}
      {usageLoading ? (
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500 shadow-sm">
          {localize(language, { en: "Loading usage status...", ko: "사용량 정보를 불러오는 중...", ja: "\u4F7F\u7528\u72B6\u6CC1\u3092\u8AAD\u307F\u8FBC\u3093\u3067\u3044\u307E\u3059...", es: "Cargando estado de uso..." })}
        </div>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          {runSummary.title}
        </p>
        <p className="mt-2 text-sm font-semibold text-stone-950">
          {runSummary.detail}
        </p>
        {mode === "sequential" ? (
          <p className="mt-1 text-xs leading-5 text-stone-600">
            {localize(language, { en: "Review the full plan before you run, especially repeat blocks and input sources.", ko: "실행 전에 전체 계획을 먼저 확인하고, 반복 구간과 입력 source가 기대한 흐름인지 점검하세요.", ja: "\u5B9F\u884C\u524D\u306B\u8A08\u753B\u5168\u4F53\u3001\u7279\u306B\u30EA\u30D4\u30FC\u30C8\u30D6\u30ED\u30C3\u30AF\u3068\u5165\u529B\u30BD\u30FC\u30B9\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Revise el plan completo antes de ejecutar, especialmente los bloques repetidos y las fuentes de entrada." })}
          </p>
        ) : (
          <p className="mt-1 text-xs leading-5 text-stone-600">
            {localize(language, { en: "Parallel compare sends the same task to multiple models so you can compare the cards right away.", ko: "병렬 비교는 같은 질문을 여러 모델에 보내고, 결과보드에서 바로 비교할 수 있습니다.", ja: "\u4E26\u5217\u6BD4\u8F03\u3067\u306F\u540C\u3058\u30BF\u30B9\u30AF\u304C\u8907\u6570\u306E\u30E2\u30C7\u30EB\u306B\u9001\u4FE1\u3055\u308C\u308B\u305F\u3081\u3001\u30AB\u30FC\u30C9\u3092\u3059\u3050\u306B\u6BD4\u8F03\u3067\u304D\u307E\u3059\u3002", es: "La comparaci\u00F3n paralela env\u00EDa la misma tarea a varios modelos para que puedas comparar las tarjetas de inmediato." })}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
              {localize(language, { en: "Estimated credits", ko: "예상 크레딧", ja: "\u63A8\u5B9A\u30AF\u30EC\u30B8\u30C3\u30C8\u6570", es: "Cr\u00E9ditos estimados" })}
            </p>
            <p className="mt-2 text-lg font-semibold text-teal-950">
              {runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}{" "}
              {localize(language, { en: "credits", ko: "크레딧", ja: "\u30AF\u30EC\u30B8\u30C3\u30C8", es: "cr\u00E9ditos" })}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-teal-200 bg-white px-3 py-2">
              <p className="text-xs text-teal-700">
                {localize(language, { en: "Calls", ko: "예상 호출", ja: "\u96FB\u8A71", es: "llamadas" })}
              </p>
              <p className="mt-1 font-semibold text-teal-950">
                {runCreditEstimate.plannedCallCount.toLocaleString(numberLocale)}
              </p>
            </div>
            <div className="rounded-md border border-teal-200 bg-white px-3 py-2">
              <p className="text-xs text-teal-700">
                {localize(language, { en: "Available", ko: "보유 크레딧", ja: "\u5229\u7528\u53EF\u80FD", es: "Disponible" })}
              </p>
              <p className="mt-1 font-semibold text-teal-950">
                {!usage
                  ? "-"
                  : usage.isUnlimitedCredits
                    ? "∞"
                    : usage.totalCreditsAvailable.toLocaleString(numberLocale)}
              </p>
              {usage && !usage.isUnlimitedCredits && dailyIsBindingCredit ? (
                <p className="mt-1 text-[11px] font-medium text-amber-700">
                  {localize(language, { en: `Today ${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)} left`, ko: `오늘 남은 ${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}`, ja: `\u4ECA\u65E5${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}\u5DE6`, es: `Hoy${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}izquierda` })}
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-teal-200 bg-white px-3 py-2">
              <p className="text-xs text-teal-700">
                {localize(language, { en: "After run", ko: "실행 후", ja: "\u8D70\u884C\u5F8C", es: "despu\u00E9s de correr" })}
              </p>
              <p className="mt-1 font-semibold text-teal-950">
                {usage?.isUnlimitedCredits
                  ? "∞"
                  : projectedCreditsAfterRun == null
                    ? "-"
                    : projectedCreditsAfterRun.toLocaleString(numberLocale)}
              </p>
            </div>
          </div>
        </div>
        {runExceedsAvailableCredits && usage ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {dailyIsBindingCredit
              ? localize(language, { en: `This run needs about ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} credits, but only ${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)} of your daily ${usage.dailyCreditLimit.toLocaleString(numberLocale)} remain today. Select fewer models or try again after the midnight (KST) reset.`, ko: `이 실행에는 약 ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} 크레딧이 필요하지만 오늘 남은 크레딧은 ${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}개입니다(일일 한도 ${usage.dailyCreditLimit.toLocaleString(numberLocale)}). 선택한 모델 수를 줄이거나 자정(KST) 초기화 후 다시 시도하세요.`, ja: `\u3053\u306E\u5B9F\u884C\u306B\u306F\u7D04${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}\u30AF\u30EC\u30B8\u30C3\u30C8\u3067\u3059\u304C\u3001${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}\u3042\u306A\u305F\u306E\u6BCE\u65E5\u306E${usage.dailyCreditLimit.toLocaleString(numberLocale)}\u4ECA\u65E5\u3082\u6B8B\u308A\u307E\u3059\u3002\u9078\u629E\u3059\u308B\u30E2\u30C7\u30EB\u3092\u6E1B\u3089\u3059\u304B\u3001\u5348\u524D 0 \u6642 (KST) \u306E\u30EA\u30BB\u30C3\u30C8\u5F8C\u306B\u518D\u8A66\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002`, es: `Esta carrera necesita aproximadamente${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}cr\u00E9ditos, pero s\u00F3lo${usage.totalDailyCreditsAvailable.toLocaleString(numberLocale)}de tu diario${usage.dailyCreditLimit.toLocaleString(numberLocale)}permanecen hoy. Seleccione menos modelos o int\u00E9ntelo nuevamente despu\u00E9s del reinicio de medianoche (KST).` })
              : localize(language, { en: `This run needs about ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} credits, but only ${usage.totalCreditsAvailable.toLocaleString(numberLocale)} are available. Select fewer models.`, ko: `이 실행에는 약 ${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)} 크레딧이 필요하지만 보유 크레딧은 ${usage.totalCreditsAvailable.toLocaleString(numberLocale)}개입니다. 선택한 모델 수를 줄여 주세요.`, ja: `\u3053\u306E\u5B9F\u884C\u306B\u306F\u7D04${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}\u30AF\u30EC\u30B8\u30C3\u30C8\u3067\u3059\u304C\u3001${usage.totalCreditsAvailable.toLocaleString(numberLocale)}\u5229\u7528\u53EF\u80FD\u3067\u3059\u3002\u9078\u629E\u3059\u308B\u30E2\u30C7\u30EB\u3092\u6E1B\u3089\u3057\u307E\u3059\u3002`, es: `Esta carrera necesita aproximadamente${runCreditEstimate.estimatedCredits.toLocaleString(numberLocale)}cr\u00E9ditos, pero s\u00F3lo${usage.totalCreditsAvailable.toLocaleString(numberLocale)}est\u00E1n disponibles. Seleccione menos modelos.` })}
          </p>
        ) : null}
      </div>

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
            {new Intl.DateTimeFormat(localize(language, { en: "en-US", ko: "ko-KR", ja: "en-US", es: "en-US" }), {
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
        <div
          ref={creditWarningRef}
          tabIndex={-1}
          className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 outline-none ring-rose-300 focus:ring-2"
        >
          {error}
        </div>
      ) : null}

      <div className="sticky top-[73px] z-30 -mx-4 bg-[#ffffff]/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 xl:hidden">
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

      <div
        className={`grid gap-5 ${
          effectiveMode === "parallel"
            ? "xl:grid-cols-[320px_minmax(0,1fr)]"
            : "xl:grid-cols-1"
        }`}
      >
        {effectiveMode === "parallel" ? (
          <aside className={`space-y-3 ${mobilePanelClass("models")}`}>
            <div className="rounded-lg border border-stone-200 bg-[#f7f6f3] p-4">
              <h2 className="text-sm font-semibold text-stone-950">
                {imageMode
                  ? localize(language, { en: "Image generation models", ko: "이미지 생성 모델", ja: "\u753B\u50CF\u751F\u6210\u30E2\u30C7\u30EB", es: "Modelos de generaci\u00F3n de im\u00E1genes." })
                  : t("modelSelection")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                {imageMode
                  ? localize(language, { en: "Pick the models that should generate images. Each selected model produces an image.", ko: "이미지를 생성할 모델을 선택하세요. 선택한 모델별로 이미지가 만들어집니다.", ja: "\u753B\u50CF\u3092\u751F\u6210\u3059\u308B\u30E2\u30C7\u30EB\u3092\u9078\u629E\u3057\u307E\u3059\u3002\u9078\u629E\u3057\u305F\u5404\u30E2\u30C7\u30EB\u304C\u30A4\u30E1\u30FC\u30B8\u3092\u751F\u6210\u3057\u307E\u3059\u3002", es: "Elija los modelos que deber\u00EDan generar im\u00E1genes. Cada modelo seleccionado produce una imagen." })
                  : t("enableProviderShort")}
              </p>
              <div className="mt-4 space-y-3">
                {imageMode
                  ? imageProviders.map((provider) => {
                      const selection = normalizeImageSelection(
                        imageSelections[provider.providerName],
                        provider,
                      );

                      return (
                        <ProviderSelectorRow
                          key={`image-${provider.providerName}`}
                          provider={provider}
                          variant="image"
                          availableModels={provider.imageModels}
                          enabled={selection.enabled}
                          selectedModels={selection.models}
                          onEnabledChange={(enabled) =>
                            setImageSelections((current) => ({
                              ...current,
                              [provider.providerName]: {
                                enabled,
                                models: enabled
                                  ? normalizeImageSelection(
                                      current[provider.providerName],
                                      provider,
                                    ).models
                                  : [],
                              },
                            }))
                          }
                          onSelectedModelsChange={(models) =>
                            setImageSelections((current) => ({
                              ...current,
                              [provider.providerName]: {
                                enabled: models.length > 0,
                                models: dedupeModels(models),
                              },
                            }))
                          }
                        />
                      );
                    })
                  : providers.map((provider) => {
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
                            setSelections((current) => {
                              const currentSelection = normalizeProviderSelection(
                                current[provider.providerName],
                                provider,
                              );
                              return {
                                ...current,
                                [provider.providerName]: nextProviderSelectionForEnabledChange(
                                  currentSelection,
                                  provider.defaultModel,
                                  enabled,
                                ),
                              };
                            })
                          }
                          onSelectedModelsChange={(models) =>
                            setSelections((current) => ({
                              ...current,
                              [provider.providerName]: {
                                enabled: models.length > 0,
                                models: dedupeModels(models),
                              },
                            }))
                          }
                        />
                      );
                    })}
              </div>
            </div>
          </aside>
        ) : null}

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
              <div className="overflow-visible sm:overflow-x-auto">
                <div className="flex flex-wrap items-center gap-2 sm:min-w-max sm:flex-nowrap">
                  <div
                    className={`inline-flex rounded-md border border-stone-200 bg-white p-1 ${
                      imageMode ? "pointer-events-none opacity-40" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setMode("parallel")}
                      className={`rounded px-3 py-2 text-sm font-semibold ${
                        !imageMode && mode === "parallel"
                          ? "bg-stone-950 text-white shadow-sm"
                          : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {t("parallelCompare")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("sequential")}
                      className={`rounded px-3 py-2 text-sm font-semibold ${
                        !imageMode && mode === "sequential"
                          ? "bg-stone-950 text-white shadow-sm"
                          : "text-stone-600 hover:bg-stone-50"
                      }`}
                    >
                      {t("sequentialReviewChain")}
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-pressed={imageMode}
                    onClick={() => {
                      const next = !imageMode;
                      setImageMode(next);
                      if (next) {
                        setMode("parallel");
                      }
                    }}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                      imageMode
                        ? "border-teal-600 bg-teal-700 text-white shadow-sm"
                        : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {localize(language, { en: "🖼 Image", ko: "🖼 이미지 생성", ja: "\uD83D\uDDBC \u753B\u50CF", es: "\uD83D\uDDBC Imagen" })}
                  </button>
                  <button
                    type="button"
                    onClick={copyOriginalInputText}
                    disabled={!originalInput.trim()}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${inputCopied ? "border-teal-300 bg-teal-50 text-teal-700" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"}`}
                  >
                    {inputCopied
                      ? (localize(language, { en: "Copied", ko: "복사됨", ja: "\u30B3\u30D4\u30FC\u3055\u308C\u307E\u3057\u305F", es: "Copiado" }))
                      : (localize(language, { en: "Copy input", ko: "질문 복사", ja: "\u5165\u529B\u3092\u30B3\u30D4\u30FC\u3059\u308B", es: "Copiar entrada" }))}
                  </button>
                </div>
              </div>
            </div>

            <textarea
              value={originalInput}
              onChange={(event) => setOriginalInput(event.target.value)}
              rows={6}
              className="mt-4 w-full rounded-md border border-stone-300 bg-[#f7f6f3] px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600"
              placeholder={t("taskTextareaPlaceholder")}
            />
            <textarea
              value={additionalInstruction}
              onChange={(event) => setAdditionalInstruction(event.target.value)}
              rows={3}
              className="mt-3 w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-teal-600"
              placeholder={t("additionalInstructionPlaceholder")}
            />

            <div className="mt-3 rounded-md border border-dashed border-stone-300 bg-[#f7f6f3] p-3">
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
                  {localize(language, { en: "Default output language", ko: "\uae30\ubcf8 \ucd9c\ub825 \uc5b8\uc5b4", ja: "\u30C7\u30D5\u30A9\u30EB\u30C8\u306E\u51FA\u529B\u8A00\u8A9E", es: "Idioma de salida predeterminado" })}
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
                className={runButtonClassName}
              >
                {running ? t("running") : t("run")}
              </button>
              {running && activeRunId ? (
                <button
                  type="button"
                  onClick={stopActiveRun}
                  disabled={cancelingRun}
                  className="w-full rounded-md border border-rose-300 bg-white px-5 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60 sm:w-auto"
                >
                  {cancelingRun
                    ? localize(language, { en: "Stopping...", ko: "중지 중...", ja: "\u505C\u6B62\u4E2D...", es: "Deteniendo..." })
                    : localize(language, { en: "Stop all", ko: "전체 작업 중지", ja: "\u5168\u90E8\u3084\u3081\u3066", es: "detener todo" })}
                </button>
              ) : null}
            </div>
          </div>

          {mode === "sequential" ? (
            <div
              className={`rounded-lg border border-stone-200 bg-[#f7f6f3] p-4 ${mobilePanelClass(
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
                  insideRepeatBlock={normalizedWorkflowControl.repeatBlocks.some(
                    (repeatBlock) =>
                      step.orderIndex >= repeatBlock.startStep &&
                      step.orderIndex <= repeatBlock.endStep,
                  )}
                />
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addStep}
                disabled={workflowSteps.length >= MAX_TEMPLATE_STEPS}
                className="flex w-full items-center justify-center gap-3 rounded-lg border-2 border-dashed border-teal-400 bg-white px-5 py-4 text-base font-bold text-teal-800 shadow-sm transition hover:border-teal-600 hover:bg-teal-50 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400 disabled:opacity-70 sm:py-5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-lg leading-none text-white">
                  +
                </span>
                <span>{t("addStep")}</span>
                <span className="text-sm font-semibold text-teal-600">
                  {workflowSteps.length}/{MAX_TEMPLATE_STEPS}
                </span>
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {localize(language, { en: "Planned run preview", ko: "실행 계획 미리보기", ja: "\u8A08\u753B\u3055\u308C\u305F\u5B9F\u884C\u306E\u30D7\u30EC\u30D3\u30E5\u30FC", es: "Vista previa de la ejecuci\u00F3n planificada" })}
                  </p>
                  <p className="text-xs leading-5 text-stone-600">
                    {localize(language, { en: `Preview all ${plannedSequentialSteps.length} planned steps before you run.`, ko: `실행 전에 총 ${plannedSequentialSteps.length}단계를 한 번에 확인합니다.`, ja: `\u3059\u3079\u3066\u30D7\u30EC\u30D3\u30E5\u30FC${plannedSequentialSteps.length}\u5B9F\u884C\u3059\u308B\u524D\u306B\u8A08\u753B\u3055\u308C\u305F\u30B9\u30C6\u30C3\u30D7\u3002`, es: `Vista previa de todo${plannedSequentialSteps.length}pasos planificados antes de ejecutar.` })}
                  </p>
                </div>
                <p className="text-xs font-medium text-stone-500">
                  {localize(language, { en: `${normalizedWorkflowControl.repeatBlocks.length} repeat block(s)`, ko: `${normalizedWorkflowControl.repeatBlocks.length}개 반복 블록`, ja: `${normalizedWorkflowControl.repeatBlocks.length}\u30D6\u30ED\u30C3\u30AF\u3092\u7E70\u308A\u8FD4\u3059`, es: `${normalizedWorkflowControl.repeatBlocks.length}repetir bloque(s)` })}
                </p>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {plannedSequentialSteps.map((step, index) => (
                  <div
                    key={`plan-step-${step.uid}-${index + 1}`}
                    className="rounded-md border border-stone-200 bg-[#f7f6f3] px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-teal-700">
                      {localize(language, { en: `Step ${index + 1}`, ko: `${index + 1}단계`, ja: `\u30B9\u30C6\u30C3\u30D7${index + 1}`, es: `Paso${index + 1}` })}
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-900">
                      {providerLabel(step.targetProvider)} /{" "}
                      {getModelDisplayName(step.targetProvider, step.targetModel)}
                    </p>
                    <p className="mt-1 text-xs text-stone-600">
                      {getActionTypeDisplayLabel(step.actionType, language)} ·{" "}
                      {step.sourceMode === "previous"
                        ? localize(language, { en: "Uses previous completed result", ko: "이전 완료 결과 사용", ja: "\u4EE5\u524D\u306B\u5B8C\u4E86\u3057\u305F\u7D50\u679C\u3092\u4F7F\u7528\u3057\u307E\u3059", es: "Utiliza el resultado completado anterior" })
                        : step.sourceMode === "selected_result"
                          ? localize(language, { en: "Uses selected result", ko: "선택 결과 고정 참조", ja: "\u9078\u629E\u3057\u305F\u7D50\u679C\u3092\u4F7F\u7528\u3057\u307E\u3059", es: "Utiliza el resultado seleccionado" })
                          : step.sourceMode === "all_results"
                            ? localize(language, { en: "Uses prior completed results", ko: "이전 완료 결과 모음 사용", ja: "\u4EE5\u524D\u306B\u5B8C\u4E86\u3057\u305F\u7D50\u679C\u3092\u4F7F\u7528\u3057\u307E\u3059", es: "Utiliza resultados completados anteriormente" })
                            : localize(language, { en: "Uses original input", ko: "원본 입력 사용", ja: "\u30AA\u30EA\u30B8\u30CA\u30EB\u306E\u5165\u529B\u3092\u4F7F\u7528", es: "Utiliza entrada original" })}
                    </p>
                  </div>
                ))}
              </div>
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
                    {MAX_TOTAL_SEQUENTIAL_STEPS}
                  </p>
                </div>

                <div className="space-y-3">
                  {normalizedWorkflowControl.repeatBlocks.length ? (
                    normalizedWorkflowControl.repeatBlocks.map((repeatBlock, index) => (
                      <div
                        key={repeatBlock.id}
                        className="rounded-md border border-stone-200 bg-stone-50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-stone-800">
                            {builderText.repeatedBlock} {index + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteRepeatBlock(repeatBlock.id)}
                            className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                          >
                            {t("delete")}
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                          <label className="block">
                            <span className="text-xs font-medium text-stone-500">
                              {builderText.repeatRange} - {builderText.repeatStart}
                            </span>
                            <select
                              value={repeatBlock.startStep}
                              onChange={(event) => {
                                const nextStartStep = Number(event.target.value);
                                updateRepeatBlock(repeatBlock.id, (current) => ({
                                  ...current,
                                  startStep: nextStartStep,
                                  endStep: Math.max(nextStartStep, current.endStep),
                                }));
                              }}
                              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
                            >
                              {workflowSteps.map((step) => (
                                <option key={`repeat-start-${repeatBlock.id}-${step.uid}`} value={step.orderIndex}>
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
                              value={repeatBlock.endStep}
                              onChange={(event) => {
                                const nextEndStep = Number(event.target.value);
                                updateRepeatBlock(repeatBlock.id, (current) => ({
                                  ...current,
                                  endStep: nextEndStep,
                                }));
                              }}
                              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
                            >
                              {workflowSteps
                                .filter((step) => step.orderIndex >= repeatBlock.startStep)
                                .map((step) => (
                                  <option key={`repeat-end-${repeatBlock.id}-${step.uid}`} value={step.orderIndex}>
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
                              max={MAX_TOTAL_SEQUENTIAL_STEPS}
                              inputMode="numeric"
                              value={
                                repeatCountDraftById[repeatBlock.id] ??
                                String(repeatBlock.repeatCount)
                              }
                              onChange={(event) => {
                                updateRepeatCountDraft(
                                  repeatBlock.id,
                                  event.target.value,
                                );
                              }}
                              onBlur={() => commitRepeatCountDraft(repeatBlock.id)}
                              className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600"
                            />
                          </label>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed border-stone-300 bg-stone-50 px-3 py-3 text-sm text-stone-600">
                      {builderText.noRepeatBlocks}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={addRepeatBlock}
                    disabled={normalizedWorkflowControl.repeatBlocks.length >= MAX_REPEAT_BLOCKS}
                    className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                  >
                    {builderText.addRepeatBlock}
                  </button>
                  <p className="text-xs text-stone-500">
                    {normalizedWorkflowControl.repeatBlocks.length}/{MAX_REPEAT_BLOCKS}
                  </p>
                </div>

                {normalizedWorkflowControl.repeatBlocks.length >= MAX_REPEAT_BLOCKS ? (
                  <p className="text-xs text-rose-700">{builderText.repeatBlockLimit}</p>
                ) : null}

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
                disabled={savingPreset}
                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${presetSavedAt ? "bg-teal-500" : "bg-teal-700 hover:bg-teal-800 disabled:opacity-60"}`}
              >
                {savingPreset ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    {localize(language, { en: "Saving…", ko: "저장 중…", ja: "\u4FDD\u5B58\u4E2D\u2026", es: "Guardando\u2026" })}
                  </>
                ) : presetSavedAt ? (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {localize(language, { en: "Saved", ko: "저장됨", ja: "\u4FDD\u5B58\u3055\u308C\u307E\u3057\u305F", es: "Guardado" })}
                  </>
                ) : (
                  t("saveRoute")
                )}
              </button>
              <button
                type="button"
                onClick={runWorkbench}
                disabled={running || uploadingAttachments}
                className={runButtonClassName}
              >
                {running ? t("running") : t("run")}
              </button>
              {running && activeRunId ? (
                <button
                  type="button"
                  onClick={stopActiveRun}
                  disabled={cancelingRun}
                  className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  {cancelingRun
                    ? localize(language, { en: "Stopping...", ko: "중지 중...", ja: "\u505C\u6B62\u4E2D...", es: "Deteniendo..." })
                    : localize(language, { en: "Stop all", ko: "전체 작업 중지", ja: "\u5168\u90E8\u3084\u3081\u3066", es: "detener todo" })}
                </button>
              ) : null}
            </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className={`space-y-4 ${mobilePanelClass("results")}`}>
        {sessionId && results.length ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-sky-950">
                  {localize(language, { en: "Share the full result view", ko: "전체 결과 공유", ja: "\u5B8C\u5168\u306A\u7D50\u679C\u30D3\u30E5\u30FC\u3092\u5171\u6709\u3059\u308B", es: "Comparte la vista completa de resultados" })}
                </p>
                <p className="text-xs leading-5 text-sky-800">
                  {localize(language, { en: "Copy a public link that opens the input, workflow, and results without sign-in.", ko: "로그인 없이 입력, 워크플로우, 결과를 볼 수 있는 공개 링크를 복사합니다.", ja: "\u30B5\u30A4\u30F3\u30A4\u30F3\u305B\u305A\u306B\u5165\u529B\u3001\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u3001\u7D50\u679C\u3092\u958B\u304F\u30D1\u30D6\u30EA\u30C3\u30AF \u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3059\u3002", es: "Copie un enlace p\u00FAblico que abra la entrada, el flujo de trabajo y los resultados sin iniciar sesi\u00F3n." })}
                </p>
              </div>
              <button
                type="button"
                onClick={shareSessionOverview}
                disabled={sharingSession}
                className="rounded-md border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100 disabled:opacity-60"
              >
                {sharingSession
                  ? localize(language, { en: "Sharing...", ko: "공유 중...", ja: "\u5171\u6709\u4E2D...", es: "Compartiendo..." })
                  : sessionShareCopied
                    ? localize(language, { en: "Link copied", ko: "링크 복사됨", ja: "\u30EA\u30F3\u30AF\u304C\u30B3\u30D4\u30FC\u3055\u308C\u307E\u3057\u305F", es: "Enlace copiado" })
                    : localize(language, { en: "Share overview link", ko: "전체 공유 링크", ja: "\u6982\u8981\u30EA\u30F3\u30AF\u3092\u5171\u6709\u3059\u308B", es: "Compartir enlace de descripci\u00F3n general" })}
              </button>
            </div>
            {sessionShareUrl ? (
              <div className="mt-3 rounded-md border border-sky-200 bg-white p-3">
                {sessionShareCopyBlocked ? (
                  <p className="mb-2 text-xs font-medium text-sky-900">
                    {localize(language, { en: "Automatic copying was blocked. The link was still created, so open it or select it below.", ko: "자동 복사가 차단됐습니다. 링크는 정상 생성됐으니 아래에서 열거나 선택해서 복사하세요.", ja: "\u81EA\u52D5\u30B3\u30D4\u30FC\u304C\u30D6\u30ED\u30C3\u30AF\u3055\u308C\u307E\u3057\u305F\u3002\u30EA\u30F3\u30AF\u306F\u307E\u3060\u4F5C\u6210\u3055\u308C\u3066\u3044\u308B\u306E\u3067\u3001\u305D\u308C\u3092\u958B\u304F\u304B\u3001\u4E0B\u304B\u3089\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044\u3002", es: "Se bloque\u00F3 la copia autom\u00E1tica. El enlace a\u00FAn se cre\u00F3, as\u00ED que \u00E1brelo o selecci\u00F3nalo a continuaci\u00F3n." })}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    value={sessionShareUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-md border border-stone-300 bg-stone-50 px-3 py-2 text-xs text-stone-700"
                    aria-label={
                      localize(language, { en: "Shared overview link", ko: "전체 공유 링크", ja: "\u5171\u6709\u6982\u8981\u30EA\u30F3\u30AF", es: "Enlace de descripci\u00F3n general compartido" })
                    }
                  />
                  <a
                    href={sessionShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-sky-300 px-3 py-2 text-center text-xs font-semibold text-sky-900 hover:bg-sky-50"
                  >
                    {localize(language, { en: "Open link", ko: "링크 열기", ja: "\u30EA\u30F3\u30AF\u3092\u958B\u304F", es: "Abrir enlace" })}
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

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
                <div className="flex flex-wrap items-center gap-2">
                  {running && activeRunId ? (
                    <button
                      type="button"
                      onClick={stopActiveRun}
                      disabled={cancelingRun}
                      className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {cancelingRun
                        ? localize(language, { en: "Stopping...", ko: "중지 중...", ja: "\u505C\u6B62\u4E2D...", es: "Deteniendo..." })
                        : localize(language, { en: "Stop all", ko: "전체 작업 중지", ja: "\u5168\u90E8\u3084\u3081\u3066", es: "detener todo" })}
                    </button>
                  ) : null}
                  <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">
                    {formatElapsedTime(runMonitor.startedAt, progressNow, language)}
                  </span>
                </div>
              ) : null}
            </div>

            {progressEntries.length ? (
              <div className="mt-4 max-h-[32rem] min-h-[15rem] overflow-y-auto pr-1">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {progressEntries.map((entry, index) => {
                  const linkedResultId = entry.orderIndex
                    ? progressResultIdsByOrderIndex.get(entry.orderIndex) ?? null
                    : null;
                  return (
                  <article
                    key={entry.key}
                    className="rounded-lg border border-stone-200 bg-[#f7f6f3] p-3"
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
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {linkedResultId ? (
                          <button
                            type="button"
                            onClick={() => jumpToResult(linkedResultId)}
                            className="rounded-md border border-teal-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-teal-800 hover:bg-teal-50"
                          >
                            {localize(language, { en: "Jump to result", ko: "결과로 이동", ja: "\u7D50\u679C\u3078\u30B8\u30E3\u30F3\u30D7", es: "Saltar al resultado" })}
                          </button>
                        ) : null}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                            entry.status === "completed"
                              ? "bg-teal-100 text-teal-800"
                              : entry.status === "failed"
                                ? "bg-rose-100 text-rose-700"
                                : entry.status === "canceled"
                                  ? "bg-rose-50 text-rose-700"
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
                              : entry.status === "canceled"
                                ? localize(language, { en: "Stopped", ko: "중지됨", ja: "\u505C\u6B62\u3057\u307E\u3057\u305F", es: "Interrumpido" })
                              : entry.status === "active"
                                ? t("statusRunning")
                                : entry.status === "skipped"
                                  ? localize(language, { en: "Skipped", ko: "건너뜀", ja: "\u30B9\u30AD\u30C3\u30D7\u3055\u308C\u307E\u3057\u305F", es: "Saltado" })
                                  : localize(language, { en: "Queued", ko: "대기", ja: "\u30AD\u30E5\u30FC\u306B\u5165\u308C\u3089\u308C\u307E\u3057\u305F", es: "En cola" })}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-stone-700">
                      {entry.detail ||
                        (entry.status === "queued" ? uiText.queued : uiText.running)}
                    </p>
                    {entry.workLines ? (
                      <div className="mt-3 grid min-w-0 gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs leading-5 text-stone-600">
                        <div className="min-w-0">
                          <span className="font-semibold text-stone-500">
                            {localize(language, { en: "System progress", ko: "\uc2dc\uc2a4\ud15c \uc9c4\ud589", ja: "\u30B7\u30B9\u30C6\u30E0\u306E\u9032\u884C\u72B6\u6CC1", es: "Progreso del sistema" })}
                          </span>
                          <p className="whitespace-normal break-words">{entry.workLines[0]}</p>
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-stone-500">
                            {localize(language, { en: "Live input/output", ko: "실시간 입력/출력", ja: "\u30E9\u30A4\u30D6\u5165\u51FA\u529B", es: "Entrada/salida en vivo" })}
                          </span>
                          <p className="whitespace-normal break-words">{entry.workLines[1]}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mode === "sequential" &&
                      running &&
                      activeRunId &&
                      entry.canStop &&
                      (entry.status === "active" || entry.status === "queued") ? (
                        <button
                          type="button"
                          onClick={() => stopRunStep(index)}
                          disabled={stoppingStepIndexes.has(index)}
                          className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-60"
                        >
                          {stoppingStepIndexes.has(index)
                            ? uiText.stoppingStep
                            : uiText.stopStep}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )})}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-stone-200 bg-[#f7f6f3] px-4 py-6 text-sm text-stone-500">
                {uiText.noProgress}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 bg-[#f7f6f3] p-4">
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

        {mode === "parallel" && !imageMode ? (
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
              <div className="flex flex-wrap items-center gap-2">
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
                <div className="inline-flex w-full rounded-md border border-stone-200 bg-[#ffffff] p-1 sm:w-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setParallelComparisonPanel((current) =>
                        toggleParallelComparisonPanelCollapsed(current),
                      )
                    }
                    className="rounded px-3 py-1.5 text-xs font-semibold text-stone-700"
                  >
                    {parallelComparisonPanel.collapsed
                      ? uiText.compareExpand
                      : uiText.compareCollapse}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setParallelComparisonPanel((current) =>
                        current.detached
                          ? closeDetachedParallelComparisonPanel(current)
                          : openDetachedParallelComparisonPanel(current),
                      )
                    }
                    className="rounded px-3 py-1.5 text-xs font-semibold text-stone-700"
                  >
                    {parallelComparisonPanel.detached
                      ? uiText.compareCloseDetached
                      : uiText.compareDetach}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-stone-500">
                {uiText.compareModels}
              </p>
              <div className="flex flex-wrap gap-2">
              {parallelComparisonCandidates.map((result) => (
                <span
                  key={result.id}
                  className="rounded-full border border-stone-200 bg-[#ffffff] px-3 py-1 text-xs font-medium text-stone-700"
                >
                  {result.provider}/{getModelDisplayName(
                    result.provider,
                    result.model,
                  )}
                </span>
              ))}
              </div>
            </div>

            {parallelComparisonPanel.detached ? (
              <p className="mt-4 text-xs font-medium text-stone-500">
                {uiText.compareDetachedHint}
              </p>
            ) : null}

            {showInlineParallelComparisonBody ? (
              <div className="mt-4 rounded-lg border border-stone-200 bg-[#f7f6f3] p-4">
                {renderParallelComparisonSummaryBody()}
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "parallel" && !imageMode && parallelComparisonPanel.detached ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/45 px-4 py-6 sm:px-6"
            onClick={() =>
              setParallelComparisonPanel((current) =>
                closeDetachedParallelComparisonPanel(current),
              )
            }
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="parallel-comparison-detached-title"
              className="flex max-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
                <div>
                  <h2
                    id="parallel-comparison-detached-title"
                    className="text-base font-semibold text-stone-950"
                  >
                    {uiText.compareTitle}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {uiText.compareDescription}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setParallelComparisonPanel((current) =>
                      closeDetachedParallelComparisonPanel(current),
                    )
                  }
                  className="rounded-md border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700"
                >
                  {uiText.compareCloseDetached}
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4">
                <div className="flex flex-col gap-4">
                  {parallelComparison.status === "completed" ? (
                    <span className="w-fit rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">
                      {uiText.compareGeneratedWith}:{" "}
                      {parallelComparison.comparison.provider}/
                      {getModelDisplayName(
                        parallelComparison.comparison.provider,
                        parallelComparison.comparison.model,
                      )}
                    </span>
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs font-medium text-stone-500">
                      {uiText.compareModels}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parallelComparisonCandidates.map((result) => (
                        <span
                          key={`detached-${result.id}`}
                          className="rounded-full border border-stone-200 bg-[#ffffff] px-3 py-1 text-xs font-medium text-stone-700"
                        >
                          {result.provider}/
                          {getModelDisplayName(result.provider, result.model)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-[#f7f6f3] p-5">
                    {renderParallelComparisonSummaryBody()}
                  </div>
                </div>
              </div>
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
              {results.length ? (
                <div className="inline-flex rounded-md border border-stone-200 bg-[#ffffff] p-1">
                  <button
                    type="button"
                    onClick={collapseAllResults}
                    disabled={!hasExpandedResults}
                    className="rounded px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {localize(language, { en: "Collapse all", ko: "전체 접기", ja: "\u3059\u3079\u3066\u6298\u308A\u305F\u305F\u3080", es: "Contraer todo" })}
                  </button>
                  <button
                    type="button"
                    onClick={expandAllResults}
                    disabled={!hasCollapsedResults}
                    className="rounded px-3 py-1.5 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {localize(language, { en: "Expand all", ko: "전체 펼치기", ja: "\u3059\u3079\u3066\u5C55\u958B", es: "Expandir todo" })}
                  </button>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-stone-500">
                  {uiText.resultLayout}
                </span>
                <div className="inline-flex w-full rounded-md border border-stone-200 bg-[#ffffff] p-1 sm:w-auto">
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
            {results.length ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_200px_180px]">
                <input
                  value={resultSearch}
                  onChange={(event) => setResultSearch(event.target.value)}
                  placeholder={
                    localize(language, { en: "Search results, models, or step keywords", ko: "결과, 모델, 단계 키워드 검색", ja: "\u691C\u7D22\u7D50\u679C\u3001\u30E2\u30C7\u30EB\u3001\u307E\u305F\u306F\u30B9\u30C6\u30C3\u30D7\u306E\u30AD\u30FC\u30EF\u30FC\u30C9", es: "Resultados de b\u00FAsqueda, modelos o palabras clave de pasos" })
                  }
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
                <select
                  value={resultFilter}
                  onChange={(event) =>
                    setResultFilter(event.target.value as ResultBoardFilter)
                  }
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                >
                  <option value="all">{localize(language, { en: "All results", ko: "전체 결과", ja: "\u3059\u3079\u3066\u306E\u7D50\u679C", es: "Todos los resultados" })}</option>
                  <option value="final">
                    {localize(language, { en: "Final only", ko: "최종결과만", ja: "\u6700\u7D42\u7D50\u679C\u306E\u307F", es: "Solo finales" })}
                  </option>
                  <option value="failed">
                    {localize(language, { en: "Failed only", ko: "실패만", ja: "\u5931\u6557\u306E\u307F", es: "S\u00F3lo fall\u00F3" })}
                  </option>
                  <option value="main">
                    {localize(language, { en: "Main only", ko: "메인 결과만", ja: "\u30E1\u30A4\u30F3\u306E\u307F", es: "Solo principal" })}
                  </option>
                  <option value="branch">
                    {localize(language, { en: "Branches only", ko: "분기만", ja: "\u5206\u5C90\u306E\u307F", es: "Solo ramas" })}
                  </option>
                </select>
                <select
                  value={resultSort}
                  onChange={(event) =>
                    setResultSort(event.target.value as ResultBoardSort)
                  }
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                >
                  <option value="workflow">
                    {localize(language, { en: "Workflow order", ko: "워크플로우 순서", ja: "\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u306E\u9806\u5E8F", es: "Orden de flujo de trabajo" })}
                  </option>
                  <option value="latest">
                    {localize(language, { en: "Latest first", ko: "최신순", ja: "\u6700\u65B0\u9806", es: "Lo \u00FAltimo primero" })}
                  </option>
                  <option value="oldest">
                    {localize(language, { en: "Oldest first", ko: "오래된순", ja: "\u53E4\u3044\u9806", es: "El m\u00E1s viejo primero" })}
                  </option>
                  <option value="failed_first">
                    {localize(language, { en: "Failed first", ko: "실패 우선", ja: "\u5931\u6557\u3092\u512A\u5148", es: "Fallidos primero" })}
                  </option>
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {results.length ? (
          <div className="space-y-6">
            {finalDisplayResult ? (
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                      {localize(language, { en: "Final result spotlight", ko: "최종결과 빠른 보기", ja: "\u6700\u7D42\u7D50\u679C\u306E\u30B9\u30DD\u30C3\u30C8\u30E9\u30A4\u30C8", es: "Destacado del resultado final" })}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-stone-950">
                      {finalDisplayResult.provider}/
                      {getModelDisplayName(
                        finalDisplayResult.provider,
                        finalDisplayResult.model,
                      )}
                    </p>
                    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                      {finalDisplayResult.outputText || finalDisplayResult.errorMessage}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => jumpToResult(finalDisplayResult.id)}
                      className="rounded-md border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                    >
                      {localize(language, { en: "Jump to final", ko: "최종결과로 이동", ja: "\u6C7A\u52DD\u3078\u30B8\u30E3\u30F3\u30D7", es: "Saltar a la final" })}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const text =
                          finalDisplayResult.outputText ||
                          finalDisplayResult.errorMessage ||
                          "";
                        const outcome = await copyTextToClipboard(text);
                        setNotice(
                          outcome.copied
                            ? localize(language, { en: "Copied the final result.", ko: "최종결과를 복사했습니다.", ja: "\u6700\u7D42\u7D50\u679C\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002", es: "Copi\u00E9 el resultado final." })
                            : localize(language, { en: "The browser blocked automatic copying.", ko: "브라우저가 자동 복사를 막았습니다.", ja: "\u30D6\u30E9\u30A6\u30B6\u304C\u81EA\u52D5\u30B3\u30D4\u30FC\u3092\u30D6\u30ED\u30C3\u30AF\u3057\u307E\u3057\u305F\u3002", es: "El navegador bloque\u00F3 la copia autom\u00E1tica." }),
                        );
                      }}
                      className="rounded-md border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                    >
                      {localize(language, { en: "Copy final", ko: "최종결과 복사", ja: "\u6700\u7D42\u30B3\u30D4\u30FC", es: "Copia final" })}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {!displayResults.length ? (
              <div className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-6 text-sm text-stone-500">
                {localize(language, { en: "No results match the current filter and search.", ko: "현재 필터와 검색 조건에 맞는 결과가 없습니다.", ja: "\u73FE\u5728\u306E\u30D5\u30A3\u30EB\u30BF\u30FC\u3068\u691C\u7D22\u306B\u4E00\u81F4\u3059\u308B\u7D50\u679C\u306F\u3042\u308A\u307E\u305B\u3093\u3002", es: "Ning\u00FAn resultado coincide con el filtro y la b\u00FAsqueda actuales." })}
              </div>
            ) : null}
            <div>
              {branchDisplayResults.length ? (
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-stone-950">
                    {localize(language, { en: "Main workflow results", ko: "메인 워크플로우 결과", ja: "\u4E3B\u306A\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u7D50\u679C", es: "Principales resultados del flujo de trabajo" })}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {localize(language, { en: "Primary outputs from the original run and sequential chain.", ko: "초기 실행과 순차 체인의 본 결과만 먼저 보여줍니다.", ja: "\u5143\u306E\u5B9F\u884C\u304A\u3088\u3073\u30B7\u30FC\u30B1\u30F3\u30B7\u30E3\u30EB \u30C1\u30A7\u30FC\u30F3\u304B\u3089\u306E\u30D7\u30E9\u30A4\u30DE\u30EA\u51FA\u529B\u3002", es: "Salidas primarias de la ejecuci\u00F3n original y la cadena secuencial." })}
                  </p>
                </div>
              ) : null}
              <div
                className={
                  resultLayout === "double"
                    ? "grid gap-3 md:grid-cols-2"
                    : "space-y-2.5"
                }
              >
            {mainDisplayResults.map((result) => {
              const parent = result.parentResultId
                ? results.find((item) => item.id === result.parentResultId)
                : null;
              return (
                <div key={result.id} className="min-w-0">
                  <ResultCard
                    result={result}
                    sessionId={sessionId}
                    depth={resultDepths.get(result.id) ?? 0}
                    compact={resultLayout === "single"}
                    expanded={resultExpansionById[result.id] ?? false}
                    isFinal={effectiveFinalResultId === result.id}
                    isLatestProgress={latestProgressResultId === result.id}
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
                    onShare={sessionId ? shareResultLink : undefined}
                    onToggleExpanded={toggleResultExpanded}
                  />
                </div>
              );
            })}
              </div>
            </div>

            {branchDisplayResults.length ? (
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-stone-950">
                    {localize(language, { en: "Follow-up and branch results", ko: "후속 질문과 분기 결과", ja: "\u30D5\u30A9\u30ED\u30FC\u30A2\u30C3\u30D7\u3068\u5206\u5C90\u7D50\u679C", es: "Seguimiento y resultados de sucursales." })}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {localize(language, { en: "Follow-up, review, and rerun outputs are separated from the main workflow results.", ko: "메인 결과에서 이어진 후속 질문, 재검토, 재실행 분기를 따로 모아 보여줍니다.", ja: "\u30D5\u30A9\u30ED\u30FC\u30A2\u30C3\u30D7\u3001\u30EC\u30D3\u30E5\u30FC\u3001\u518D\u5B9F\u884C\u306E\u51FA\u529B\u306F\u3001\u30E1\u30A4\u30F3\u306E\u30EF\u30FC\u30AF\u30D5\u30ED\u30FC\u7D50\u679C\u304B\u3089\u5206\u96E2\u3055\u308C\u307E\u3059\u3002", es: "Los resultados de seguimiento, revisi\u00F3n y repetici\u00F3n est\u00E1n separados de los resultados principales del flujo de trabajo." })}
                  </p>
                </div>
                <div
                  className={
                    resultLayout === "double"
                      ? "grid gap-3 md:grid-cols-2"
                      : "space-y-2.5"
                  }
                >
                  {branchDisplayResults.map((result) => {
                    const parent = result.parentResultId
                      ? results.find((item) => item.id === result.parentResultId)
                      : null;
                    return (
                      <div key={result.id} className="min-w-0">
                        <ResultCard
                          result={result}
                          sessionId={sessionId}
                          depth={Math.max((resultDepths.get(result.id) ?? 1) - 1, 0)}
                          compact={resultLayout === "single"}
                          expanded={resultExpansionById[result.id] ?? false}
                          isFinal={effectiveFinalResultId === result.id}
                          isLatestProgress={latestProgressResultId === result.id}
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
                          onShare={sessionId ? shareResultLink : undefined}
                          onToggleExpanded={toggleResultExpanded}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState
            title={t("noResultsTitle")}
            description={t("noResultsDescription")}
          />
        )}
      </section>

      {showResultScrollControls ? (
        <div className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-3 z-50 flex flex-col gap-2 lg:bottom-6 lg:right-6">
          <button
            type="button"
            disabled={!resultStartTargetId}
            aria-label={
              localize(language, { en: "Go to the start of the current result", ko: "현재 결과 시작점으로 가기", ja: "\u73FE\u5728\u306E\u7D50\u679C\u306E\u5148\u982D\u306B\u79FB\u52D5\u3057\u307E\u3059", es: "Ir al inicio del resultado actual" })
            }
            title={
              localize(language, { en: "Go to the start of the current result", ko: "현재 결과 시작점으로 가기", ja: "\u73FE\u5728\u306E\u7D50\u679C\u306E\u5148\u982D\u306B\u79FB\u52D5\u3057\u307E\u3059", es: "Ir al inicio del resultado actual" })
            }
            onClick={jumpToCurrentResultStart}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800 shadow-lg shadow-stone-200/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 15V5" />
              <path d="M5 10 10 5l5 5" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={
              localize(language, { en: "Go to AI progress", ko: "AI 진행 상태로 가기", ja: "AI\u306E\u9032\u6B69\u3078", es: "Ir al progreso de la IA" })
            }
            title={
              localize(language, { en: "Go to AI progress", ko: "AI 진행 상태로 가기", ja: "AI\u306E\u9032\u6B69\u3078", es: "Ir al progreso de la IA" })
            }
            onClick={jumpToProgressStart}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-stone-300 bg-stone-950 text-white shadow-lg shadow-stone-300/70 hover:bg-stone-800"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 17V8" />
              <path d="M5.5 12.5 10 8l4.5 4.5" />
              <path d="M5.5 7.5 10 3l4.5 4.5" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
