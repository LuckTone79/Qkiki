"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { ProviderName } from "@/lib/ai/types";
import { getModelOptionLabel } from "@/lib/ai/model-display";

const text = {
  en: {
    title: "Provider settings",
    description: "Set one active config per provider. Keys are encrypted server-side and masked in UI.",
    envKey: "Configured by environment variable",
    storedKey: "Stored key:",
    noStoredKey: "No stored key",
    health: "Health:",
    neverChecked: "never checked",
    enableProvider: "Enable provider",
    defaultModel: "Default model",
    fallbackProvider: "Fallback provider",
    none: "None",
    dailyUserLimit: "Daily user limit",
    timeoutSeconds: "Timeout (seconds)",
    rotateApiKey: "Rotate API key",
    leaveBlank: "Leave blank to keep current key",
    clearStoredKey: "Clear stored key",
    saveProvider: "Save",
    runHealthCheck: "Run health check",
    failedLoad: "Could not load provider settings.",
    failedSave: "Could not save provider settings.",
    failedHealthCheck: "Could not run provider health check.",
    saved: "settings saved.",
    healthCheckDone: "health check completed.",
  },
  ko: {
    title: "공급자 설정",
    description: "공급자당 하나의 활성 설정을 지정합니다. 키는 서버사이드에서 암호화되며 UI에서 마스킹됩니다.",
    envKey: "환경 변수로 설정됨",
    storedKey: "저장된 키:",
    noStoredKey: "저장된 키 없음",
    health: "상태:",
    neverChecked: "점검 없음",
    enableProvider: "공급자 활성화",
    defaultModel: "기본 모델",
    fallbackProvider: "대체 공급자",
    none: "없음",
    dailyUserLimit: "일일 사용자 제한",
    timeoutSeconds: "타임아웃(초)",
    rotateApiKey: "API 키 교체",
    leaveBlank: "현재 키 유지 시 빈칸으로 두세요",
    clearStoredKey: "저장된 키 삭제",
    saveProvider: "저장",
    runHealthCheck: "상태 점검",
    failedLoad: "공급자 설정을 불러오지 못했습니다.",
    failedSave: "공급자 설정 저장에 실패했습니다.",
    failedHealthCheck: "공급자 상태 점검에 실패했습니다.",
    saved: "설정이 저장되었습니다.",
    healthCheckDone: "상태 점검이 완료되었습니다.",
  },
} as const;

type AdminProviderOption = {
  providerName: ProviderName;
  displayName: string;
  shortName: string;
  models: string[];
  defaultModel: string;
  isEnabled: boolean;
  fallbackProvider: string | null;
  perUserDailyLimit: number;
  timeoutSeconds: number;
  healthStatus: string;
  lastHealthCheckedAt: string | null;
  hasEnvKey: boolean;
  hasStoredKey: boolean;
  apiKeyMasked: string | null;
  status: string;
};

type Drafts = Record<
  string,
  {
    isEnabled: boolean;
    defaultModel: string;
    fallbackProvider: string;
    perUserDailyLimit: number;
    timeoutSeconds: number;
    apiKey: string;
    clearStoredKey: boolean;
  }
>;

export function AdminProvidersClient() {
  const { language } = useLanguage();
  const t = text[language];
  const locale = language === "ko" ? "ko-KR" : "en-US";

  const [providers, setProviders] = useState<AdminProviderOption[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadProviders = useCallback(async () => {
    const response = await fetch("/api/admin/providers");
    const data = (await response.json().catch(() => ({}))) as {
      providers?: AdminProviderOption[];
      error?: string;
    };

    if (!response.ok || !data.providers) {
      setError(data.error || t.failedLoad);
      return;
    }

    setProviders(data.providers);
    const next: Drafts = {};
    data.providers.forEach((provider) => {
      next[provider.providerName] = {
        isEnabled: provider.isEnabled,
        defaultModel: provider.defaultModel,
        fallbackProvider: provider.fallbackProvider ?? "",
        perUserDailyLimit: provider.perUserDailyLimit,
        timeoutSeconds: provider.timeoutSeconds,
        apiKey: "",
        clearStoredKey: false,
      };
    });
    setDrafts(next);
  }, [t.failedLoad]);

  async function saveProvider(provider: AdminProviderOption) {
    setNotice("");
    setError("");

    const draft = drafts[provider.providerName];
    const response = await fetch("/api/admin/providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerName: provider.providerName,
        isEnabled: draft.isEnabled,
        defaultModel: draft.defaultModel,
        fallbackProvider: draft.fallbackProvider || null,
        perUserDailyLimit: draft.perUserDailyLimit,
        timeoutSeconds: draft.timeoutSeconds,
        apiKey: draft.apiKey,
        clearStoredKey: draft.clearStoredKey,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(data.error || t.failedSave);
      return;
    }

    setNotice(`${provider.displayName} ${t.saved}`);
    await loadProviders();
  }

  async function runHealthCheck(provider: AdminProviderOption) {
    setNotice("");
    setError("");

    const response = await fetch(
      `/api/admin/providers/${provider.providerName}/health-check`,
      { method: "POST" },
    );
    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(data.error || t.failedHealthCheck);
      return;
    }

    setNotice(`${provider.displayName} ${t.healthCheckDone}`);
    await loadProviders();
  }

  function updateDraft(providerName: string, value: Partial<Drafts[string]>) {
    setDrafts((current) => ({
      ...current,
      [providerName]: { ...current[providerName], ...value },
    }));
  }

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.description}</p>
      </header>

      {notice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {providers.map((provider) => {
          const draft = drafts[provider.providerName];
          if (!draft) return null;

          return (
            <section
              key={provider.providerName}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">{provider.displayName}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {provider.hasEnvKey
                      ? t.envKey
                      : provider.hasStoredKey
                        ? `${t.storedKey} ${provider.apiKeyMasked || "masked"}`
                        : t.noStoredKey}
                  </p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-semibold ${
                    provider.status === "ready"
                      ? "bg-emerald-100 text-emerald-700"
                      : provider.status === "disabled"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {provider.status}
                </span>
              </div>

              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t.health} <span className="font-semibold">{provider.healthStatus}</span>
                {provider.lastHealthCheckedAt
                  ? ` · ${new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(provider.lastHealthCheckedAt))}`
                  : ` · ${t.neverChecked}`}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={draft.isEnabled}
                    onChange={(event) =>
                      updateDraft(provider.providerName, { isEnabled: event.target.checked })
                    }
                    className="h-4 w-4 accent-slate-900"
                  />
                  {t.enableProvider}
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">{t.defaultModel}</span>
                  <select
                    value={draft.defaultModel}
                    onChange={(event) =>
                      updateDraft(provider.providerName, { defaultModel: event.target.value })
                    }
                    className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
                  >
                    {provider.models.map((model) => (
                      <option key={model} value={model}>
                        {getModelOptionLabel(provider.providerName, model)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">{t.fallbackProvider}</span>
                  <select
                    value={draft.fallbackProvider}
                    onChange={(event) =>
                      updateDraft(provider.providerName, { fallbackProvider: event.target.value })
                    }
                    className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
                  >
                    <option value="">{t.none}</option>
                    {providers
                      .filter((item) => item.providerName !== provider.providerName)
                      .map((item) => (
                        <option key={item.providerName} value={item.providerName}>
                          {item.displayName}
                        </option>
                      ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t.dailyUserLimit}</span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={draft.perUserDailyLimit}
                      onChange={(event) =>
                        updateDraft(provider.providerName, {
                          perUserDailyLimit: Number(event.target.value),
                        })
                      }
                      className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">{t.timeoutSeconds}</span>
                    <input
                      type="number"
                      min={5}
                      max={300}
                      value={draft.timeoutSeconds}
                      onChange={(event) =>
                        updateDraft(provider.providerName, {
                          timeoutSeconds: Number(event.target.value),
                        })
                      }
                      className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">{t.rotateApiKey}</span>
                  <input
                    type="password"
                    value={draft.apiKey}
                    onChange={(event) =>
                      updateDraft(provider.providerName, { apiKey: event.target.value })
                    }
                    className="mt-1 min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-700"
                    placeholder={t.leaveBlank}
                  />
                </label>

                {provider.hasStoredKey ? (
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={draft.clearStoredKey}
                      onChange={(event) =>
                        updateDraft(provider.providerName, {
                          clearStoredKey: event.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-rose-700"
                    />
                    {t.clearStoredKey}
                  </label>
                ) : null}

                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => saveProvider(provider)}
                    className="min-h-10 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {t.saveProvider}
                  </button>
                  <button
                    type="button"
                    onClick={() => runHealthCheck(provider)}
                    className="min-h-10 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t.runHealthCheck}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
