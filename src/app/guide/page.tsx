"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { APP_VERSION } from "@/lib/version";

/* ------------------------------------------------------------------ */
/*  i18n dictionary                                                    */
/* ------------------------------------------------------------------ */

const guide = {
  en: {
    /* hero */
    eyebrow: "Qkiki Guidebook",
    heroTitle: "Your First Steps with Qkiki",
    heroSubtitle:
      "A step-by-step guide to comparing, routing, and branching AI model outputs — all from one workspace.",

    /* CTA */
    getStarted: "Start using Qkiki",
    backToHome: "Back to Home",

    /* why different */
    diffTitle: "How is Qkiki different?",
    diffSubtitle:
      "Qkiki isn't another chatbot. It's an orchestration workbench that turns several AI models into a structured review pipeline.",

    diffItems: [
      {
        icon: "parallel",
        title: "Parallel Compare",
        desc: "Send one task to GPT, Claude, Gemini, and Grok at once. See every answer side by side on result cards — not buried in separate chat windows.",
        vs: "Other platforms: open 4 tabs, paste the same prompt 4 times, manually compare.",
      },
      {
        icon: "chain",
        title: "Sequential Review Chain",
        desc: "Route one model's output into the next. For example: GPT drafts → Grok critiques → Gemini improves → Claude polishes the final answer.",
        vs: "Other platforms: copy-paste between chats, lose context at every step.",
      },
      {
        icon: "branch",
        title: "Branching & Follow-up",
        desc: "Every result card is actionable. Branch it to another model for critique, improvement, fact-check, or summarization — building a tree of evolving answers.",
        vs: "Other platforms: results are final text. No built-in way to chain or branch.",
      },
      {
        icon: "project",
        title: "Project Folders",
        desc: "Group related sessions under one project. Shared notes and recent outputs travel with every run inside that project.",
        vs: "Other platforms: each conversation is isolated, no shared memory across chats.",
      },
      {
        icon: "preset",
        title: "Reusable Presets",
        desc: "Save a good review chain as a preset. Load it whenever you need the same multi-model workflow again — no rebuilding from scratch.",
        vs: "Other platforms: recreate the same prompt sequence every time.",
      },
      {
        icon: "attach",
        title: "File Attachments",
        desc: "Attach text, images, or PDFs to your task. Files are processed server-side and injected into prompts automatically for all models.",
        vs: "Other platforms: file upload support varies per model, no cross-model file sharing.",
      },
    ],

    /* step-by-step guide */
    guideTitle: "Step-by-Step Guide",
    guideSubtitle: "From sign-up to your first multi-AI workflow in 8 steps.",

    steps: [
      {
        num: "01",
        title: "Sign up or sign in",
        desc: "Create your account with email/password or Google login. Your provider settings, sessions, results, and presets are all scoped to your account.",
        tip: 'Click "Get started" on the landing page to start a free trial instantly.',
      },
      {
        num: "02",
        title: "Check available AI models",
        desc: "AI providers (GPT, Claude, Gemini, Grok) are pre-configured by the platform. Open the Workbench and check the Model Selection panel — models marked \"ready\" are available for your tasks right away.",
        tip: "All provider keys and credentials are managed server-side by the administrator. You don't need to set up any API keys yourself.",
      },
      {
        num: "03",
        title: "Open the Workbench",
        desc: 'Click "Workbench" in the left menu. This is your main workspace — where you write tasks, select models, build workflows, and see results.',
        tip: null,
      },
      {
        num: "04",
        title: "Write a task and select models",
        desc: 'Type your question, analysis request, or instruction in the text area. Then enable the AI models you want to compare by toggling them in the "Model Selection" panel. You can also choose an output style (detailed, short, bullet, table, or executive) to control how results are formatted.',
        tip: "Use the additional instruction field to add optional context, constraints, or evaluation criteria. Attach files (text, images, PDF) for richer inputs.",
      },
      {
        num: "05",
        title: "Run Parallel Compare",
        desc: 'With "Parallel Compare" mode selected, click Run. All enabled models process the same task simultaneously. Results appear as individual cards showing the output, token usage, latency, and estimated cost.',
        tip: "If one model fails, other results remain intact. Failed models show an error card you can rerun.",
      },
      {
        num: "06",
        title: "Build a Sequential Review Chain",
        desc: 'Switch to "Sequential Review Chain" mode. Add steps where each targets a specific model and action (generate, critique, improve, summarize, fact-check). Each step can consume the original input, the previous step, or a selected result.',
        tip: 'Example chain: Step 1 GPT "Draft" → Step 2 Grok "Critique" → Step 3 Gemini "Improve" → Step 4 Claude "Polish."',
      },
      {
        num: "07",
        title: "Work with results",
        desc: 'Each result card is actionable. Click "Review with Other Model" to branch, "Follow Up" to continue the conversation, "Mark Final" to designate the best answer, or "Rerun" to regenerate.',
        tip: "Results build a tree. Every branch becomes a new starting point for further work.",
      },
      {
        num: "08",
        title: "Organize with Projects and Presets",
        desc: "Create project folders to group related sessions. Save useful workflow chains as presets. Sessions inside a project share context and recent outputs automatically.",
        tip: "Load a saved preset from the workbench to instantly apply a proven review chain to a new task.",
      },
    ],

    /* features overview */
    featuresTitle: "Feature Overview",
    features: [
      { label: "Supported models", value: "GPT, Claude, Gemini, Grok (17 model variants)" },
      { label: "Workflow modes", value: "Parallel Compare & Sequential Review Chain" },
      { label: "Actions", value: "Generate, Critique, Fact-check, Improve, Summarize, Simplify, Consistency Review, Follow-up" },
      { label: "Attachments", value: "Text, Image, PDF — server-side processing" },
      { label: "Languages", value: "English & Korean (switchable anytime)" },
      { label: "Security", value: "Encrypted credentials, HttpOnly cookies, server-side only provider calls" },
    ],

    /* FAQ */
    faqTitle: "FAQ",
    faqs: [
      {
        q: "Do I need to set up my own API keys?",
        a: "No. AI providers are pre-configured by the platform administrator. Just open the Workbench and start using the models that show as \"ready\" in the Model Selection panel.",
      },
      {
        q: "Is my data secure?",
        a: "Yes. All AI calls happen server-side only — your inputs never go directly to external providers from your browser. Sessions use HttpOnly cookies, and all credentials are encrypted.",
      },
      {
        q: "Can I use Qkiki on mobile?",
        a: "Yes. The workbench is fully responsive with a mobile-optimized bottom navigation bar and collapsible panels for models, input, workflow, and results.",
      },
      {
        q: "What file types can I attach?",
        a: "Text files (.txt, .md, .csv), JSON, PDF documents, and images (.png, .jpg, .webp, .gif). Files are processed server-side and included in prompts for all models.",
      },
      {
        q: "What happens if one AI model fails during a run?",
        a: "Other models continue normally. The failed model shows an error card that you can rerun individually without re-running the entire workflow.",
      },
    ],

    /* bottom CTA */
    ctaTitle: "Ready to get started?",
    ctaSubtitle:
      "Experience orchestrating multiple AI models in one unified workflow.",

    /* footer */
    version: "Version",
    copyright: "Qkiki by Wideget",
  },

  ko: {
    /* hero */
    eyebrow: "Qkiki 가이드북",
    heroTitle: "Qkiki 시작하기",
    heroSubtitle:
      "여러 AI 모델의 답변을 비교하고, 연결하고, 분기하는 오케스트레이션 워크벤치를 단계별로 안내합니다.",

    /* CTA */
    getStarted: "Qkiki 시작하기",
    backToHome: "홈으로 돌아가기",

    /* why different */
    diffTitle: "Qkiki는 뭐가 다른가요?",
    diffSubtitle:
      "Qkiki는 챗봇이 아닙니다. 여러 AI 모델을 하나의 검토 파이프라인으로 연결하는 오케스트레이션 워크벤치입니다.",

    diffItems: [
      {
        icon: "parallel",
        title: "병렬 비교",
        desc: "하나의 작업을 GPT, Claude, Gemini, Grok에 동시에 보냅니다. 결과 카드에서 모든 답변을 나란히 비교하세요.",
        vs: "다른 플랫폼: 4개 탭을 열고 같은 프롬프트를 4번 붙여넣고 직접 비교해야 합니다.",
      },
      {
        icon: "chain",
        title: "순차 검토 체인",
        desc: "한 모델의 출력을 다음 모델의 입력으로 연결합니다. 예: GPT가 초안 작성 → Grok이 비판 → Gemini가 개선 → Claude가 최종 답변 완성.",
        vs: "다른 플랫폼: 채팅 간 복사-붙여넣기, 매 단계마다 맥락 손실.",
      },
      {
        icon: "branch",
        title: "분기 & 후속 질문",
        desc: "모든 결과 카드에서 바로 작업 가능합니다. 다른 모델로 비판, 개선, 팩트체크, 요약을 요청하여 답변이 진화하는 트리를 만드세요.",
        vs: "다른 플랫폼: 결과는 최종 텍스트일 뿐, 연결이나 분기하는 기능이 없습니다.",
      },
      {
        icon: "project",
        title: "프로젝트 폴더",
        desc: "관련 세션을 하나의 프로젝트로 묶으세요. 공유 메모와 최근 결과가 프로젝트 내 모든 실행에 자동 포함됩니다.",
        vs: "다른 플랫폼: 각 대화가 독립적이라 채팅 간 공유 메모리가 없습니다.",
      },
      {
        icon: "preset",
        title: "재사용 프리셋",
        desc: "좋은 검토 체인을 프리셋으로 저장하세요. 같은 멀티 모델 워크플로우가 필요할 때 한 번에 불러올 수 있습니다.",
        vs: "다른 플랫폼: 매번 같은 프롬프트 순서를 처음부터 다시 만들어야 합니다.",
      },
      {
        icon: "attach",
        title: "파일 첨부",
        desc: "텍스트, 이미지, PDF를 작업에 첨부하세요. 파일은 서버에서 처리되어 모든 모델의 프롬프트에 자동 주입됩니다.",
        vs: "다른 플랫폼: 모델별 파일 업로드 지원이 제각각, 교차 모델 파일 공유 불가.",
      },
    ],

    /* step-by-step guide */
    guideTitle: "단계별 사용 가이드",
    guideSubtitle: "회원가입부터 첫 멀티 AI 워크플로우까지 8단계로 안내합니다.",

    steps: [
      {
        num: "01",
        title: "회원가입 또는 로그인",
        desc: "이메일/비밀번호 또는 Google 로그인으로 계정을 만드세요. 프로바이더 설정, 세션, 결과, 프리셋 모두 계정별로 안전하게 관리됩니다.",
        tip: '랜딩 페이지에서 "시작하기"를 클릭하면 바로 체험판을 시작할 수 있습니다.',
      },
      {
        num: "02",
        title: "사용 가능한 AI 모델 확인",
        desc: "AI 프로바이더(GPT, Claude, Gemini, Grok)는 플랫폼에서 미리 설정되어 있습니다. 워크벤치를 열고 모델 선택 패널에서 \"준비됨\"으로 표시된 모델을 바로 사용할 수 있습니다.",
        tip: "모든 프로바이더 키와 자격 증명은 관리자가 서버 측에서 관리합니다. API 키를 직접 설정할 필요가 없습니다.",
      },
      {
        num: "03",
        title: "워크벤치 열기",
        desc: '왼쪽 메뉴에서 "워크벤치"를 클릭하세요. 이곳이 핵심 작업 공간입니다 — 작업 입력, 모델 선택, 워크플로우 구성, 결과 확인이 모두 여기서 이루어집니다.',
        tip: null,
      },
      {
        num: "04",
        title: "작업 입력 & 모델 선택",
        desc: '텍스트 영역에 질문, 분석 요청, 지시문을 입력하세요. "모델 선택" 패널에서 비교할 AI 모델을 토글로 켜세요. 출력 스타일(상세, 짧게, 글머리, 표, 요약)을 선택해 결과 형식을 조절할 수도 있습니다.',
        tip: "추가 지시 필드에 맥락, 제약 조건, 평가 기준을 입력하세요. 텍스트, 이미지, PDF 파일도 첨부 가능합니다.",
      },
      {
        num: "05",
        title: "병렬 비교 실행",
        desc: '"병렬 비교" 모드에서 실행을 누르세요. 선택한 모든 모델이 동시에 같은 작업을 처리합니다. 결과는 출력, 토큰 사용량, 지연 시간, 예상 비용을 보여주는 개별 카드로 나타납니다.',
        tip: "한 모델이 실패해도 나머지 결과는 정상 유지됩니다. 실패한 모델은 개별 재실행이 가능합니다.",
      },
      {
        num: "06",
        title: "순차 검토 체인 만들기",
        desc: '"순차 검토 체인" 모드로 전환하세요. 각 단계에서 특정 모델과 작업(생성, 비판, 개선, 요약, 팩트체크)을 지정합니다. 각 단계는 원본 입력, 이전 단계, 또는 선택한 결과를 소스로 사용할 수 있습니다.',
        tip: '예시: 1단계 GPT "초안" → 2단계 Grok "비판" → 3단계 Gemini "개선" → 4단계 Claude "다듬기".',
      },
      {
        num: "07",
        title: "결과 활용하기",
        desc: '각 결과 카드에서 바로 작업을 이어갈 수 있습니다. "다른 모델로 검토"로 분기, "이어서 질문"으로 대화 계속, "최종 표시"로 최고 답변 지정, "다시 실행"으로 재생성하세요.',
        tip: "결과는 트리 형태로 쌓입니다. 모든 분기가 새로운 출발점이 됩니다.",
      },
      {
        num: "08",
        title: "프로젝트 & 프리셋으로 정리",
        desc: "프로젝트 폴더를 만들어 관련 세션을 묶으세요. 유용한 워크플로우 체인은 프리셋으로 저장하세요. 프로젝트 안의 세션은 컨텍스트와 최근 결과를 자동으로 공유합니다.",
        tip: "워크벤치에서 저장된 프리셋을 불러오면 검증된 검토 체인을 새 작업에 바로 적용할 수 있습니다.",
      },
    ],

    /* features overview */
    featuresTitle: "기능 한눈에 보기",
    features: [
      { label: "지원 모델", value: "GPT, Claude, Gemini, Grok (17개 모델 변형)" },
      { label: "워크플로우 모드", value: "병렬 비교 & 순차 검토 체인" },
      { label: "작업 유형", value: "생성, 비판, 팩트체크, 개선, 요약, 단순화, 일관성 검토, 후속 질문" },
      { label: "첨부 파일", value: "텍스트, 이미지, PDF — 서버 측 처리" },
      { label: "언어", value: "영어 & 한국어 (언제든 전환 가능)" },
      { label: "보안", value: "자격 증명 암호화, HttpOnly 쿠키, 서버 측 전용 AI 호출" },
    ],

    /* FAQ */
    faqTitle: "자주 묻는 질문",
    faqs: [
      {
        q: "API 키를 직접 설정해야 하나요?",
        a: "아닙니다. AI 프로바이더는 플랫폼 관리자가 미리 설정합니다. 워크벤치를 열고 모델 선택 패널에서 \"준비됨\"으로 표시된 모델을 바로 사용하시면 됩니다.",
      },
      {
        q: "내 데이터는 안전한가요?",
        a: "네. 모든 AI 호출은 서버 측에서만 이루어지며 입력 내용이 브라우저에서 직접 외부로 전송되지 않습니다. HttpOnly 쿠키로 세션을 관리하고 모든 자격 증명은 암호화됩니다.",
      },
      {
        q: "모바일에서도 사용할 수 있나요?",
        a: "네. 워크벤치는 완전 반응형이며 모바일 최적화된 하단 네비게이션 바와 접을 수 있는 패널을 지원합니다.",
      },
      {
        q: "어떤 파일을 첨부할 수 있나요?",
        a: "텍스트 파일(.txt, .md, .csv), JSON, PDF 문서, 이미지(.png, .jpg, .webp, .gif)를 지원합니다. 파일은 서버에서 처리되어 모든 모델 프롬프트에 포함됩니다.",
      },
      {
        q: "실행 중 AI 모델 하나가 실패하면 어떻게 되나요?",
        a: "다른 모델은 정상적으로 계속됩니다. 실패한 모델은 에러 카드로 표시되며 전체 워크플로우를 재실행하지 않고 개별적으로 다시 실행할 수 있습니다.",
      },
    ],

    /* bottom CTA */
    ctaTitle: "지금 바로 시작해보세요",
    ctaSubtitle:
      "여러 AI 모델을 하나의 워크플로우로 연결하는 경험을 직접 해보세요.",

    /* footer */
    version: "버전",
    copyright: "Qkiki by Wideget",
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Icon components                                                    */
/* ------------------------------------------------------------------ */

function IconParallel() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <rect x="2" y="3" width="8" height="7" rx="1.5" />
      <rect x="14" y="3" width="8" height="7" rx="1.5" />
      <rect x="2" y="14" width="8" height="7" rx="1.5" />
      <rect x="14" y="14" width="8" height="7" rx="1.5" />
    </svg>
  );
}

function IconChain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <circle cx="4" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="20" cy="12" r="2.5" />
      <path d="M6.5 12h3M14.5 12h3" />
    </svg>
  );
}

function IconBranch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <circle cx="12" cy="4" r="2.5" />
      <circle cx="6" cy="20" r="2.5" />
      <circle cx="18" cy="20" r="2.5" />
      <path d="M12 6.5v5M12 11.5l-6 6M12 11.5l6 6" />
    </svg>
  );
}

function IconProject() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M9 13h6M9 16h4" />
    </svg>
  );
}

function IconPreset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function IconAttach() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

const iconMap: Record<string, () => React.JSX.Element> = {
  parallel: IconParallel,
  chain: IconChain,
  branch: IconBranch,
  project: IconProject,
  preset: IconPreset,
  attach: IconAttach,
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GuidePage() {
  const { language } = useLanguage();
  const t = guide[language];

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-stone-950">
      {/* ─── Sticky top bar ─── */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/" className="text-sm font-semibold text-stone-700 hover:text-stone-950">
            {t.backToHome}
          </Link>
          <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
            {t.version} {APP_VERSION}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-24 pt-10">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  HERO                                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            {t.heroTitle}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-600">
            {t.heroSubtitle}
          </p>
          <div className="mt-8">
            <Link
              href="/sign-up"
              className="inline-block rounded-md bg-stone-950 px-6 py-3 text-sm font-semibold text-white hover:bg-stone-800"
            >
              {t.getStarted}
            </Link>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  WHY DIFFERENT                                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-24">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            {t.diffTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base text-stone-600">
            {t.diffSubtitle}
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.diffItems.map((item) => {
              const Icon = iconMap[item.icon] ?? IconParallel;
              return (
                <article
                  key={item.icon}
                  className="group rounded-xl border border-stone-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-700 transition group-hover:bg-teal-100">
                    <Icon />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {item.desc}
                  </p>
                  <p className="mt-3 rounded-md border border-stone-100 bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-500">
                    {item.vs}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  STEP-BY-STEP GUIDE                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-28">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            {t.guideTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-stone-600">
            {t.guideSubtitle}
          </p>

          <div className="relative mt-14">
            {/* vertical timeline line */}
            <div className="absolute left-6 top-0 hidden h-full w-px bg-stone-200 sm:block" />

            <div className="space-y-8">
              {t.steps.map((step) => (
                <div key={step.num} className="relative flex gap-6">
                  {/* step number bubble */}
                  <div className="relative z-10 flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-teal-600 bg-white text-sm font-bold text-teal-700">
                    {step.num}
                  </div>

                  <div className="flex-1 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-stone-950">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-stone-600">
                      {step.desc}
                    </p>
                    {step.tip ? (
                      <p className="mt-3 rounded-md border border-teal-100 bg-teal-50 px-4 py-2 text-xs leading-5 text-teal-800">
                        {"TIP: "}
                        {step.tip}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  FEATURES OVERVIEW TABLE                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-28">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            {t.featuresTitle}
          </h2>

          <div className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            {t.features.map((f, featIdx) => (
              <div
                key={featIdx}
                className={`flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4 ${
                  featIdx !== t.features.length - 1 ? "border-b border-stone-100" : ""
                }`}
              >
                <span className="w-40 flex-none text-sm font-semibold text-stone-800">
                  {f.label}
                </span>
                <span className="text-sm text-stone-600">{f.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  FAQ                                                       */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-28">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            {t.faqTitle}
          </h2>

          <div className="mx-auto mt-10 max-w-2xl space-y-4">
            {t.faqs.map((faq, faqIdx) => (
              <details
                key={faqIdx}
                className="group rounded-xl border border-stone-200 bg-white shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-stone-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span>{faq.q}</span>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 flex-none text-stone-400 transition-transform group-open:rotate-180"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </summary>
                <p className="border-t border-stone-100 px-6 py-4 text-sm leading-7 text-stone-600">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  BOTTOM CTA                                                */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-28 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            {t.ctaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-stone-600">
            {t.ctaSubtitle}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-stone-950 px-6 py-3 text-sm font-semibold text-white hover:bg-stone-800"
            >
              {t.getStarted}
            </Link>
            <Link
              href="/"
              className="rounded-md border border-stone-300 bg-white px-6 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-50"
            >
              {t.backToHome}
            </Link>
          </div>
        </section>

        {/* ─── footer ─── */}
        <footer className="mt-20 border-t border-stone-200 pt-8 text-center text-xs text-stone-500">
          <p>{t.copyright}</p>
          <p className="mt-1">
            {t.version} {APP_VERSION}
          </p>
        </footer>
      </div>
    </main>
  );
}
