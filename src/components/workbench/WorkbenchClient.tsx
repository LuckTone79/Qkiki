"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
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
  writeSessionCache,
  readSessionCache,
} from "@/lib/local-cache";

type ProviderSelection = {
  enabled: boolean;
  model: string;
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

const outputStyles = ["detailed", "short", "bullet", "table", "executive"];
const outputStyleLabels: Record<string, Record<AppLanguage, string>> = {
  detailed: { en: "detailed", ko: "\uc790\uc138\ud788" },
  short: { en: "short", ko: "\uc9e7\uac8c" },
  bullet: { en: "bullet", ko: "\uae00\uba38\ub9ac\ud45c" },
  table: { en: "table", ko: "\ud45c" },
  executive: { en: "executive", ko: "\uc784\uc6d0 \uc694\uc57d" },
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
      targetModel: "gpt-5.4",
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
      targetModel: "grok-4.20",
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
      targetModel: "gemini-3.1-pro-preview",
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

export function WorkbenchClient() {
  const { language, t } = useLanguage();
  const builderText = workflowBuilderText[language];
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
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        next[provider.providerName] = next[provider.providerName] ?? {
          enabled: provider.isEnabled,
          model: provider.defaultModel,
        };
      });
      return next;
    });
    setWorkflowSteps((steps) =>
      steps.map((step) => {
        const provider = data.providers.find(
          (item) => item.providerName === step.targetProvider,
        );
        return provider && !provider.models.includes(step.targetModel)
          ? { ...step, targetModel: provider.defaultModel }
          : step;
      }),
    );
  }

  function applyPreset(preset: Preset) {
    const parsed = JSON.parse(preset.workflowJson) as Record<string, unknown>;
    const parsedSteps = (parsed.steps as Omit<WorkflowStepState, "uid">[] | undefined)?.slice(
      0,
      MAX_TEMPLATE_STEPS,
    );

    if (parsedSteps?.length) {
      setWorkflowSteps(
        sortSteps(
          parsedSteps.map((step) => ({
            ...step,
            uid: newUid(),
          })),
        ),
      );
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
    setMode(session.mode === "sequential" ? "sequential" : "parallel");
    setFinalResultId(session.finalResultId);
    setAttachments(session.attachments || []);
    setResults(session.results);
    if (session.workflowSteps.length) {
      setWorkflowSteps(
        sortSteps(
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
        label: `${index + 1}. ${result.provider}/${result.model}`,
      })),
    [results],
  );

  const selectedTargets = useMemo<TargetModelInput[]>(() => {
    return providers
      .filter((provider) => selections[provider.providerName]?.enabled)
      .map((provider) => ({
        provider: provider.providerName,
        model: selections[provider.providerName]?.model || provider.defaultModel,
      }));
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
          targetModel: provider?.defaultModel ?? last?.targetModel ?? "gpt-5.4",
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

    setRunning(true);
    const response = await fetch("/api/workbench/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        projectId: project?.id ?? null,
        title: sessionTitle || null,
        originalInput,
        additionalInstruction,
        outputStyle,
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
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      session?: { id: string; title: string; finalResultId?: string | null };
      results?: WorkbenchResult[];
      executionSummary?: {
        plannedTotal: number;
        executedTotal: number;
        stoppedEarly: boolean;
        stopReason?: string | null;
      };
      error?: string;
    };
    setRunning(false);

    if (!response.ok || !data.session) {
      setError(language === "ko" ? t("runFailed") : data.error || t("runFailed"));
      return;
    }

    setSessionId(data.session.id);
    setSessionTitle(data.session.title);
    setFinalResultId(data.session.finalResultId || null);
    setResults((current) => mergeResults(current, data.results || []));
    setActiveMobilePanel("results");
    clearDraft();
    setDraftBanner(null);
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
      body: JSON.stringify(input),
    });
    const data = (await response.json().catch(() => ({}))) as {
      results?: WorkbenchResult[];
      error?: string;
    };

    if (!response.ok) {
      setError(
        language === "ko"
          ? t("branchRunFailed")
          : data.error || t("branchRunFailed"),
      );
      return;
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
      error?: string;
    };

    if (!response.ok || !data.result) {
      setError(
        language === "ko" ? t("rerunFailed") : data.error || t("rerunFailed"),
      );
      return;
    }

    const rerun = data.result;
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
    { id: "workflow", label: t("mobileWorkflow") },
    {
      id: "results",
      label: results.length
        ? `${t("mobileResults")} (${results.length})`
        : t("mobileResults"),
    },
  ];

  const mobilePanelClass = (panel: MobilePanel) =>
    activeMobilePanel === panel ? "block" : "hidden xl:block";

  const middlePanelClass =
    activeMobilePanel === "input" || activeMobilePanel === "workflow"
      ? "block"
      : "hidden xl:block";

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={t("workbench")}
        title={t("compareBranchRoute")}
        description={t("workbenchDescription")}
      />

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

      <div className="grid gap-5 xl:grid-cols-[320px_1fr_0.95fr]">
        <aside className={`space-y-3 ${mobilePanelClass("models")}`}>
          <div className="rounded-lg border border-stone-200 bg-[#fbfcf8] p-4">
            <h2 className="text-sm font-semibold text-stone-950">
              {t("modelSelection")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-stone-600">
              {t("enableProviderShort")}
            </p>
            <div className="mt-4 space-y-3">
              {providers.map((provider) => (
                <ProviderSelectorRow
                  key={provider.providerName}
                  provider={provider}
                  enabled={Boolean(selections[provider.providerName]?.enabled)}
                  model={
                    selections[provider.providerName]?.model ||
                    provider.defaultModel
                  }
                  onEnabledChange={(enabled) =>
                    setSelections({
                      ...selections,
                      [provider.providerName]: {
                        enabled,
                        model:
                          selections[provider.providerName]?.model ||
                          provider.defaultModel,
                      },
                    })
                  }
                  onModelChange={(model) =>
                    setSelections({
                      ...selections,
                      [provider.providerName]: {
                        enabled:
                          selections[provider.providerName]?.enabled ?? false,
                        model,
                      },
                    })
                  }
                />
              ))}
            </div>
          </div>
        </aside>

        <section className={`space-y-5 ${middlePanelClass}`}>
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

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex flex-col gap-1 text-sm text-stone-600 sm:block">
                {t("outputStyle")}{" "}
                <select
                  value={outputStyle}
                  onChange={(event) => setOutputStyle(event.target.value)}
                  className="rounded-md border border-stone-300 bg-white px-2 py-2 text-sm outline-none focus:border-teal-600 sm:ml-2"
                >
                  {outputStyles.map((style) => (
                    <option key={style} value={style}>
                      {outputStyleLabels[style]?.[language] ?? style}
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

            <div className="mt-4 grid gap-2 rounded-lg border border-stone-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]">
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
            </div>
          </div>
        </section>

        <section className={`space-y-3 ${mobilePanelClass("results")}`}>
          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-stone-950">
                  {t("resultBoard")}
                </h2>
                <p className="text-sm text-stone-600">
                  {t("resultBoardDescription")}
                </p>
              </div>
              {sessionId ? (
                <span className="rounded-md border border-stone-200 px-2 py-1 text-xs text-stone-500">
                  {t("saved")}
                </span>
              ) : null}
            </div>
          </div>

          {results.length ? (
            <div className="space-y-3">
              {results.map((result) => {
                const parent = result.parentResultId
                  ? results.find((item) => item.id === result.parentResultId)
                  : null;
                return (
                  <ResultCard
                    key={result.id}
                    result={result}
                    depth={resultDepths.get(result.id) ?? 0}
                    isFinal={finalResultId === result.id}
                    providers={providers}
                    sourceLabel={
                      parent
                        ? `${t("source")}: ${parent.provider}/${parent.model}`
                        : undefined
                    }
                    onBranch={runBranch}
                    onRerun={rerunResult}
                    onMarkFinal={markFinal}
                    onDelete={deleteBranch}
                  />
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
    </div>
  );
}
