"use client";

import Link from "next/link";
import { localize, useLanguage } from "@/components/i18n/LanguageProvider";
import { APP_VERSION } from "@/lib/version";

/* ------------------------------------------------------------------ */
/*  i18n dictionary                                                    */
/* ------------------------------------------------------------------ */

const guide = {
  en: {
    /* hero */
    eyebrow: "Yapp Guidebook",
    heroTitle: "Your First Steps with Yapp",
    heroSubtitle:
      "A step-by-step guide to comparing, routing, and branching AI model outputs — all from one workspace.",

    /* CTA */
    getStarted: "Start using Yapp",
    backToHome: "Back to Home",

    /* why different */
    diffTitle: "How is Yapp different?",
    diffSubtitle:
      "Yapp isn't another chatbot. It's an orchestration workbench that turns several AI models into a structured review pipeline.",

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
        desc: "Attach text, Word, images, or PDFs to your task. Files are processed server-side and injected into prompts automatically for all models.",
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
        desc: 'Type your question, analysis request, or instruction in the text area. Then enable the AI models you want to compare by toggling them in the "Model Selection" panel. You can also choose an output style (detailed, short, bullet, table, or results-focused) to control how results are formatted.',
        tip: "Use the additional instruction field to add optional context, constraints, or evaluation criteria. Attach files (text, Word, images, PDF) for richer inputs.",
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

    /* parallel compare tutorial */
    parallelTutorial: {
      title: "Parallel Compare — Step-by-Step Tutorial",
      subtitle:
        "Send your question to multiple AI models at once and compare their answers side by side!",
      steps: [
        {
          num: "1",
          title: "Select Parallel Compare mode",
          desc: 'At the top of the Workbench, click "Parallel Compare." The button lights up to show it\'s selected.',
        },
        {
          num: "2",
          title: "Turn on your AI models",
          desc: "In the model list, you'll see: GPT, Claude, Gemini, and Grok. Click the checkbox next to each model you want to use. Try picking 2 or 3!",
        },
        {
          num: "3",
          title: "Type your question",
          desc: 'Click the big text box and type your question. Example: "Explain why the sky is blue in simple words."',
        },
        {
          num: "4",
          title: "Pick an output style (optional)",
          desc: 'Choose how you want answers formatted: Detailed (long), Short (brief), Bullet (list), Table (grid), or Results-focused (summary). Not sure? Just leave it on "Detailed."',
        },
        {
          num: "5",
          title: "Attach files if needed (optional)",
          desc: "Click the attach button to add Word documents, images, PDFs, or text files. All selected AI models will read your files automatically.",
        },
        {
          num: "6",
          title: "Press the Run button",
          desc: 'Click the green "▶ Run" button. All your selected AI models start working on your question at the same time!',
        },
        {
          num: "7",
          title: "Wait a moment",
          desc: "Each model shows a progress indicator. They all think simultaneously — it usually takes just a few seconds.",
        },
        {
          num: "8",
          title: "Compare the results!",
          desc: "Results appear as cards — one per AI model. Read them side by side to see how each AI answered differently. Each card also shows time taken and tokens used.",
        },
      ],
    },

    /* sequential review chain tutorial */
    sequentialTutorial: {
      title: "Sequential Review Chain — Step-by-Step Tutorial",
      subtitle:
        "AI models work like a relay team — each one reads and improves the previous answer!",
      steps: [
        {
          num: "1",
          title: "Select Sequential Review Chain mode",
          desc: 'At the top of the Workbench, click "Sequential Review Chain." The screen changes to show a chain of connected steps.',
        },
        {
          num: "2",
          title: "Look at the default chain",
          desc: "You'll see 3 steps already set up: Step 1 (GPT → Generate) → Step 2 (Grok → Critique) → Step 3 (Gemini → Improve). This is your starting chain!",
        },
        {
          num: "3",
          title: "Customize each step",
          desc: 'For each step you can pick: which AI model (dropdown), what action (Generate, Critique, Improve, Summarize, Fact-check, Simplify), and add special instructions like "Focus on grammar mistakes."',
        },
        {
          num: "4",
          title: "Add or remove steps",
          desc: 'Click "+" to add a new step at the end. Click the trash icon to remove a step. You can have as many or as few as you want!',
        },
        {
          num: "5",
          title: "Type your starting question",
          desc: 'In the text box, type the question for Step 1 to work on. Example: "Write a short story about a robot who learns to paint."',
        },
        {
          num: "6",
          title: "Press the Run button",
          desc: 'Click the green "▶ Run" button. The chain starts running from Step 1.',
        },
        {
          num: "7",
          title: "Watch the chain work",
          desc: "Step 1 runs first and creates an answer. That answer automatically goes to Step 2, which does its job (like critiquing). Then Step 2's result goes to Step 3, and so on — like a relay race!",
        },
        {
          num: "8",
          title: "See all the results!",
          desc: "When the chain finishes, you can read every step's output. The last step has the final, polished answer. Click any step to see what that AI wrote.",
        },
      ],
    },

    /* features overview */
    featuresTitle: "Feature Overview",
    features: [
      { label: "Supported models", value: "GPT, Claude, Gemini, Grok (16 model variants)" },
      { label: "Workflow modes", value: "Parallel Compare & Sequential Review Chain" },
      { label: "Actions", value: "Generate, Brainstorm, Critique, Fact-check, Improve, Summarize, Simplify, Consistency Review, Code Review, Follow-up" },
      { label: "Attachments", value: "Text, Word, Image, PDF — server-side processing" },
      { label: "Languages", value: "English, Korean, Japanese & Spanish (switchable anytime)" },
      { label: "Security", value: "Encrypted credentials, HttpOnly cookies, server-side only provider calls" },
    ],

    /* FAQ */
    faqTitle: "FAQ",
    faqs: [
      {
        q: "Is my data secure?",
        a: "Yes. All AI calls happen server-side only — your inputs never go directly to external providers from your browser. Sessions use HttpOnly cookies, and all credentials are encrypted.",
      },
      {
        q: "Can I use Yapp on mobile?",
        a: "Yes. The workbench is fully responsive with a mobile-optimized bottom navigation bar and collapsible panels for models, input, workflow, and results.",
      },
      {
        q: "What file types can I attach?",
        a: "Text files (.txt, .md, .csv), JSON, Word documents (.docx), PDF documents, and images (.png, .jpg, .webp, .gif). Files are processed server-side and included in prompts for all models.",
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
    copyright: "Yapp by Wideget",
  },

  ko: {
    /* hero */
    eyebrow: "Yapp 가이드북",
    heroTitle: "Yapp 시작하기",
    heroSubtitle:
      "여러 AI 모델의 답변을 비교하고, 연결하고, 분기하는 오케스트레이션 워크벤치를 단계별로 안내합니다.",

    /* CTA */
    getStarted: "Yapp 시작하기",
    backToHome: "홈으로 돌아가기",

    /* why different */
    diffTitle: "Yapp은 뭐가 다른가요?",
    diffSubtitle:
      "Yapp은 챗봇이 아닙니다. 여러 AI 모델을 하나의 검토 파이프라인으로 연결하는 오케스트레이션 워크벤치입니다.",

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
        desc: "텍스트, Word, 이미지, PDF를 작업에 첨부하세요. 파일은 서버에서 처리되어 모든 모델의 프롬프트에 자동 주입됩니다.",
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
        tip: "추가 지시 필드에 맥락, 제약 조건, 평가 기준을 입력하세요. 텍스트, Word, 이미지, PDF 파일도 첨부 가능합니다.",
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

    /* parallel compare tutorial */
    parallelTutorial: {
      title: "병렬 비교 — 따라하기 가이드",
      subtitle:
        "내 질문을 여러 AI에게 동시에 보내고, 답변을 나란히 비교해보세요!",
      steps: [
        {
          num: "1",
          title: "병렬 비교 모드 선택하기",
          desc: "워크벤치 위쪽에서 \"병렬 비교\"를 클릭하세요. 버튼이 켜져서 선택된 것을 알 수 있어요.",
        },
        {
          num: "2",
          title: "AI 모델 켜기",
          desc: "모델 목록에 GPT, Claude, Gemini, Grok이 보여요. 사용하고 싶은 모델 옆의 체크박스를 클릭하세요. 처음에는 2~3개를 골라보세요!",
        },
        {
          num: "3",
          title: "질문 입력하기",
          desc: "큰 텍스트 상자를 클릭하고 질문을 입력하세요. 예시: \"하늘이 파란 이유를 쉽게 설명해줘.\"",
        },
        {
          num: "4",
          title: "출력 스타일 고르기 (선택)",
          desc: "답변 형식을 골라보세요: 상세(길게), 짧게(간단히), 글머리(목록), 표(격자), 요약(핵심만). 잘 모르겠으면 \"상세\"로 두면 돼요.",
        },
        {
          num: "5",
          title: "파일 첨부하기 (선택)",
          desc: "첨부 버튼을 누르면 Word 문서, 이미지, PDF, 텍스트 파일을 추가할 수 있어요. 선택한 모든 AI 모델이 파일을 자동으로 읽어요.",
        },
        {
          num: "6",
          title: "실행 버튼 누르기",
          desc: "초록색 \"▶ 실행\" 버튼을 클릭하세요. 선택한 모든 AI 모델이 동시에 질문을 처리하기 시작해요!",
        },
        {
          num: "7",
          title: "잠깐 기다리기",
          desc: "각 모델마다 진행 표시가 나타나요. 모두 동시에 생각하니까 보통 몇 초면 끝나요.",
        },
        {
          num: "8",
          title: "결과 비교하기!",
          desc: "결과가 카드로 나타나요 — AI 모델마다 하나씩. 나란히 읽으면서 각 AI가 어떻게 다르게 답했는지 비교해보세요. 각 카드에는 걸린 시간과 토큰 수도 표시돼요.",
        },
      ],
    },

    /* sequential review chain tutorial */
    sequentialTutorial: {
      title: "순차 검토 체인 — 따라하기 가이드",
      subtitle:
        "AI 모델들이 릴레이처럼 협력해요 — 앞 AI의 답변을 다음 AI가 읽고 개선해요!",
      steps: [
        {
          num: "1",
          title: "순차 검토 체인 모드 선택하기",
          desc: "워크벤치 위쪽에서 \"순차 검토 체인\"을 클릭하세요. 화면이 체인 형태로 바뀌어요.",
        },
        {
          num: "2",
          title: "기본 체인 확인하기",
          desc: "이미 3단계가 만들어져 있어요: 1단계(GPT → 생성) → 2단계(Grok → 비판) → 3단계(Gemini → 개선). 이게 기본 체인이에요!",
        },
        {
          num: "3",
          title: "각 단계 바꾸기 (원하면)",
          desc: "각 단계에서 바꿀 수 있는 것: 어떤 AI 모델을 쓸지(드롭다운), 무엇을 할지(생성, 비판, 개선, 요약, 팩트체크, 단순화), 그리고 특별 지시(예: \"문법 오류에 집중해줘.\").",
        },
        {
          num: "4",
          title: "단계 추가/삭제하기",
          desc: "\"+\" 버튼을 클릭하면 새 단계가 추가돼요. 휴지통 아이콘을 클릭하면 단계가 삭제돼요. 원하는 만큼 자유롭게 조절할 수 있어요!",
        },
        {
          num: "5",
          title: "시작 질문 입력하기",
          desc: "텍스트 상자에 1단계가 처리할 질문을 입력하세요. 예시: \"그림 그리는 법을 배우는 로봇에 대한 짧은 이야기를 써줘.\"",
        },
        {
          num: "6",
          title: "실행 버튼 누르기",
          desc: "초록색 \"▶ 실행\" 버튼을 클릭하세요. 1단계부터 체인이 시작돼요.",
        },
        {
          num: "7",
          title: "체인이 일하는 모습 보기",
          desc: "1단계가 먼저 실행되어 답변을 만들어요. 그 답변이 자동으로 2단계에 전달되고, 2단계가 작업(비판 등)을 해요. 2단계 결과가 3단계로 넘어가고... 릴레이 경주처럼 계속돼요!",
        },
        {
          num: "8",
          title: "모든 결과 확인하기!",
          desc: "체인이 끝나면 모든 단계의 결과를 볼 수 있어요. 마지막 단계에 최종 완성된 답변이 있어요. 아무 단계나 클릭하면 그 AI가 쓴 내용을 볼 수 있답니다.",
        },
      ],
    },

    /* features overview */
    featuresTitle: "기능 한눈에 보기",
    features: [
      { label: "지원 모델", value: "GPT, Claude, Gemini, Grok (16개 모델 변형)" },
      { label: "워크플로우 모드", value: "병렬 비교 & 순차 검토 체인" },
      { label: "작업 유형", value: "생성, 브레인스토밍, 비판, 팩트체크, 개선, 요약, 단순화, 일관성 검토, 코드 리뷰, 후속 질문" },
      { label: "첨부 파일", value: "텍스트, Word, 이미지, PDF — 서버 측 처리" },
      { label: "언어", value: "영어, 한국어, 일본어 & 스페인어 (언제든 전환 가능)" },
      { label: "보안", value: "자격 증명 암호화, HttpOnly 쿠키, 서버 측 전용 AI 호출" },
    ],

    /* FAQ */
    faqTitle: "자주 묻는 질문",
    faqs: [
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
        a: "텍스트 파일(.txt, .md, .csv), JSON, Word 문서(.docx), PDF 문서, 이미지(.png, .jpg, .webp, .gif)를 지원합니다. 파일은 서버에서 처리되어 모든 모델 프롬프트에 포함됩니다.",
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
    copyright: "Yapp by Wideget",
  },

  ja: {
    /* hero */
    eyebrow: "Yapp ガイドブック",
    heroTitle: "Yapp をはじめよう",
    heroSubtitle:
      "複数の AI モデルの出力を比較・ルーティング・分岐する方法を、1つのワークスペースから順を追って案内します。",

    /* CTA */
    getStarted: "Yapp を使ってみる",
    backToHome: "ホームに戻る",

    /* why different */
    diffTitle: "Yapp は何が違うの？",
    diffSubtitle:
      "Yapp はただのチャットボットではありません。複数の AI モデルを構造化されたレビューパイプラインに変えるオーケストレーションワークベンチです。",

    diffItems: [
      {
        icon: "parallel",
        title: "並列比較",
        desc: "1つのタスクを GPT、Claude、Gemini、Grok に同時に送信。結果カードですべての回答を並べて確認できます。別々のチャット画面に埋もれません。",
        vs: "他のプラットフォーム: 4つのタブを開き、同じプロンプトを4回貼り付けて手動で比較。",
      },
      {
        icon: "chain",
        title: "順次レビューチェーン",
        desc: "あるモデルの出力を次のモデルに渡します。例: GPT が下書き → Grok が批評 → Gemini が改善 → Claude が最終回答を仕上げ。",
        vs: "他のプラットフォーム: チャット間でコピペし、各ステップで文脈を失う。",
      },
      {
        icon: "branch",
        title: "分岐とフォローアップ",
        desc: "すべての結果カードが操作可能です。別のモデルに分岐して批評・改善・ファクトチェック・要約させ、進化する回答のツリーを構築します。",
        vs: "他のプラットフォーム: 結果は最終テキストのみ。連結や分岐の手段がない。",
      },
      {
        icon: "project",
        title: "プロジェクトフォルダー",
        desc: "関連するセッションを1つのプロジェクトにまとめます。共有メモと最近の出力がプロジェクト内のすべての実行に引き継がれます。",
        vs: "他のプラットフォーム: 各会話が独立し、チャット間で共有メモリがない。",
      },
      {
        icon: "preset",
        title: "再利用プリセット",
        desc: "良いレビューチェーンをプリセットとして保存。同じマルチモデルのワークフローが必要なときにいつでも読み込めます。一から作り直す必要はありません。",
        vs: "他のプラットフォーム: 毎回同じプロンプト手順を最初から作り直す。",
      },
      {
        icon: "attach",
        title: "ファイル添付",
        desc: "テキスト、Word、画像、PDF をタスクに添付。ファイルはサーバー側で処理され、すべてのモデルのプロンプトに自動で挿入されます。",
        vs: "他のプラットフォーム: モデルごとに対応がバラバラで、モデル間のファイル共有ができない。",
      },
    ],

    /* step-by-step guide */
    guideTitle: "ステップバイステップガイド",
    guideSubtitle: "サインアップから最初のマルチ AI ワークフローまで8ステップで。",

    steps: [
      {
        num: "01",
        title: "サインアップまたはログイン",
        desc: "メール/パスワードまたは Google ログインでアカウントを作成します。プロバイダー設定、セッション、結果、プリセットはすべてアカウントごとに分離されます。",
        tip: 'ランディングページで「始める」をクリックすると、すぐに無料トライアルを開始できます。',
      },
      {
        num: "02",
        title: "利用可能な AI モデルを確認",
        desc: "AI プロバイダー（GPT、Claude、Gemini、Grok）はプラットフォーム側で事前設定済みです。ワークベンチを開き、モデル選択パネルで「準備完了」と表示されたモデルをすぐに使えます。",
        tip: "すべてのプロバイダーキーと認証情報は管理者がサーバー側で管理します。API キーを自分で設定する必要はありません。",
      },
      {
        num: "03",
        title: "ワークベンチを開く",
        desc: '左メニューの「ワークベンチ」をクリックします。ここがメインの作業空間で、タスクの入力、モデルの選択、ワークフローの構築、結果の確認をすべて行います。',
        tip: null,
      },
      {
        num: "04",
        title: "タスクを入力してモデルを選択",
        desc: 'テキストエリアに質問、分析依頼、指示を入力します。次に「モデル選択」パネルで比較したい AI モデルをトグルで有効化します。出力スタイル（詳細、簡潔、箇条書き、表、要約）を選んで結果の形式を調整することもできます。',
        tip: "追加指示フィールドに任意の文脈、制約、評価基準を加えられます。テキスト、Word、画像、PDF も添付できます。",
      },
      {
        num: "05",
        title: "並列比較を実行",
        desc: '「並列比較」モードを選択して実行をクリックします。有効なすべてのモデルが同じタスクを同時に処理します。結果は出力、トークン使用量、レイテンシー、概算コストを示す個別カードとして表示されます。',
        tip: "あるモデルが失敗しても他の結果はそのまま残ります。失敗したモデルは再実行できるエラーカードで表示されます。",
      },
      {
        num: "06",
        title: "順次レビューチェーンを構築",
        desc: '「順次レビューチェーン」モードに切り替えます。各ステップで特定のモデルとアクション（生成、批評、改善、要約、ファクトチェック）を指定します。各ステップは元の入力、前のステップ、または選択した結果をソースにできます。',
        tip: '例: ステップ1 GPT「下書き」→ ステップ2 Grok「批評」→ ステップ3 Gemini「改善」→ ステップ4 Claude「仕上げ」。',
      },
      {
        num: "07",
        title: "結果を活用する",
        desc: '各結果カードは操作可能です。「別のモデルでレビュー」で分岐、「追加質問」で会話を継続、「最終としてマーク」で最良の回答を指定、「再実行」で再生成できます。',
        tip: "結果はツリー状に積み上がります。すべての分岐が次の作業の起点になります。",
      },
      {
        num: "08",
        title: "プロジェクトとプリセットで整理",
        desc: "プロジェクトフォルダーを作って関連セッションをまとめます。便利なワークフローチェーンはプリセットとして保存します。プロジェクト内のセッションは文脈と最近の出力を自動で共有します。",
        tip: "保存したプリセットをワークベンチから読み込めば、実証済みのレビューチェーンを新しいタスクにすぐ適用できます。",
      },
    ],

    /* parallel compare tutorial */
    parallelTutorial: {
      title: "並列比較 — ステップバイステップ チュートリアル",
      subtitle:
        "あなたの質問を複数の AI モデルに同時に送り、回答を並べて比較しましょう！",
      steps: [
        {
          num: "1",
          title: "並列比較モードを選ぶ",
          desc: 'ワークベンチの上部で「並列比較」をクリックします。ボタンが点灯して選択中だとわかります。',
        },
        {
          num: "2",
          title: "AI モデルをオンにする",
          desc: "モデル一覧に GPT、Claude、Gemini、Grok が表示されます。使いたいモデルの横のチェックボックスをクリックします。まずは2〜3個選んでみましょう！",
        },
        {
          num: "3",
          title: "質問を入力する",
          desc: '大きなテキストボックスをクリックして質問を入力します。例:「空が青い理由をわかりやすく説明して。」',
        },
        {
          num: "4",
          title: "出力スタイルを選ぶ（任意）",
          desc: '回答の形式を選びます: 詳細（長め）、簡潔（短め）、箇条書き（リスト）、表（グリッド）、要約（要点）。迷ったら「詳細」のままで大丈夫です。',
        },
        {
          num: "5",
          title: "必要ならファイルを添付（任意）",
          desc: "添付ボタンをクリックして Word 文書、画像、PDF、テキストファイルを追加できます。選択したすべての AI モデルがファイルを自動で読み込みます。",
        },
        {
          num: "6",
          title: "実行ボタンを押す",
          desc: '緑色の「▶ 実行」ボタンをクリックします。選択したすべての AI モデルが同時に質問の処理を開始します！',
        },
        {
          num: "7",
          title: "少し待つ",
          desc: "各モデルに進行状況が表示されます。すべて同時に考えるので、通常は数秒で終わります。",
        },
        {
          num: "8",
          title: "結果を比較する！",
          desc: "結果が AI モデルごとにカードとして表示されます。並べて読み、各 AI がどう違う回答をしたか比較しましょう。各カードには所要時間と使用トークン数も表示されます。",
        },
      ],
    },

    /* sequential review chain tutorial */
    sequentialTutorial: {
      title: "順次レビューチェーン — ステップバイステップ チュートリアル",
      subtitle:
        "AI モデルがリレーチームのように協力します — それぞれが前の回答を読んで改善します！",
      steps: [
        {
          num: "1",
          title: "順次レビューチェーンモードを選ぶ",
          desc: 'ワークベンチの上部で「順次レビューチェーン」をクリックします。画面が連結されたステップのチェーン表示に変わります。',
        },
        {
          num: "2",
          title: "デフォルトのチェーンを見る",
          desc: "すでに3つのステップが設定されています: ステップ1（GPT → 生成）→ ステップ2（Grok → 批評）→ ステップ3（Gemini → 改善）。これが出発点のチェーンです！",
        },
        {
          num: "3",
          title: "各ステップをカスタマイズ",
          desc: '各ステップで選べます: どの AI モデルを使うか（ドロップダウン）、何をするか（生成、批評、改善、要約、ファクトチェック、簡潔化）、そして「文法ミスに注目して」などの特別な指示。',
        },
        {
          num: "4",
          title: "ステップを追加・削除",
          desc: '「+」をクリックすると末尾に新しいステップを追加できます。ゴミ箱アイコンでステップを削除できます。好きなだけ自由に調整できます！',
        },
        {
          num: "5",
          title: "最初の質問を入力",
          desc: 'テキストボックスにステップ1が処理する質問を入力します。例:「絵を描くことを学ぶロボットについての短い物語を書いて。」',
        },
        {
          num: "6",
          title: "実行ボタンを押す",
          desc: '緑色の「▶ 実行」ボタンをクリックします。ステップ1からチェーンが始まります。',
        },
        {
          num: "7",
          title: "チェーンの動きを見る",
          desc: "ステップ1がまず実行されて回答を作ります。その回答が自動でステップ2に渡され、ステップ2が作業（批評など）をします。ステップ2の結果がステップ3へ…リレー競走のように続きます！",
        },
        {
          num: "8",
          title: "すべての結果を確認！",
          desc: "チェーンが終わると、すべてのステップの出力を読めます。最後のステップに最終的に仕上がった回答があります。どのステップをクリックしても、その AI が書いた内容を見られます。",
        },
      ],
    },

    /* features overview */
    featuresTitle: "機能の概要",
    features: [
      { label: "対応モデル", value: "GPT、Claude、Gemini、Grok（16のモデルバリアント）" },
      { label: "ワークフローモード", value: "並列比較 & 順次レビューチェーン" },
      { label: "アクション", value: "生成、ブレインストーミング、批評、ファクトチェック、改善、要約、簡潔化、一貫性レビュー、コードレビュー、追加質問" },
      { label: "添付ファイル", value: "テキスト、Word、画像、PDF — サーバー側処理" },
      { label: "言語", value: "英語、韓国語、日本語 & スペイン語（いつでも切替可能）" },
      { label: "セキュリティ", value: "認証情報の暗号化、HttpOnly Cookie、サーバー側専用の AI 呼び出し" },
    ],

    /* FAQ */
    faqTitle: "よくある質問",
    faqs: [
      {
        q: "私のデータは安全ですか？",
        a: "はい。すべての AI 呼び出しはサーバー側のみで行われ、入力内容がブラウザーから外部プロバイダーに直接送信されることはありません。セッションは HttpOnly Cookie を使用し、すべての認証情報は暗号化されます。",
      },
      {
        q: "モバイルでも使えますか？",
        a: "はい。ワークベンチは完全レスポンシブで、モバイル最適化された下部ナビゲーションバーと、モデル・入力・ワークフロー・結果の折りたたみパネルを備えています。",
      },
      {
        q: "どんなファイルを添付できますか？",
        a: "テキストファイル（.txt、.md、.csv）、JSON、Word 文書（.docx）、PDF 文書、画像（.png、.jpg、.webp、.gif）。ファイルはサーバー側で処理され、すべてのモデルのプロンプトに含まれます。",
      },
      {
        q: "実行中に AI モデルが1つ失敗したらどうなりますか？",
        a: "他のモデルは通常どおり続行します。失敗したモデルはエラーカードとして表示され、ワークフロー全体を再実行せずに個別に再実行できます。",
      },
    ],

    /* bottom CTA */
    ctaTitle: "始める準備はできましたか？",
    ctaSubtitle:
      "複数の AI モデルを1つの統合ワークフローでオーケストレーションする体験をしてみましょう。",

    /* footer */
    version: "バージョン",
    copyright: "Yapp by Wideget",
  },

  es: {
    /* hero */
    eyebrow: "Guía de Yapp",
    heroTitle: "Tus primeros pasos con Yapp",
    heroSubtitle:
      "Una guía paso a paso para comparar, enrutar y ramificar las salidas de modelos de IA, todo desde un solo espacio de trabajo.",

    /* CTA */
    getStarted: "Empezar a usar Yapp",
    backToHome: "Volver al inicio",

    /* why different */
    diffTitle: "¿En qué se diferencia Yapp?",
    diffSubtitle:
      "Yapp no es otro chatbot. Es un banco de trabajo de orquestación que convierte varios modelos de IA en una canalización de revisión estructurada.",

    diffItems: [
      {
        icon: "parallel",
        title: "Comparación paralela",
        desc: "Envía una tarea a GPT, Claude, Gemini y Grok a la vez. Mira cada respuesta una al lado de la otra en tarjetas de resultados, no enterradas en ventanas de chat separadas.",
        vs: "Otras plataformas: abre 4 pestañas, pega el mismo prompt 4 veces y compara manualmente.",
      },
      {
        icon: "chain",
        title: "Cadena de revisión secuencial",
        desc: "Enruta la salida de un modelo al siguiente. Por ejemplo: GPT redacta → Grok critica → Gemini mejora → Claude pule la respuesta final.",
        vs: "Otras plataformas: copia y pega entre chats, perdiendo contexto en cada paso.",
      },
      {
        icon: "branch",
        title: "Ramificación y seguimiento",
        desc: "Cada tarjeta de resultado es accionable. Ramifícala a otro modelo para crítica, mejora, verificación o resumen, construyendo un árbol de respuestas en evolución.",
        vs: "Otras plataformas: los resultados son texto final. Sin forma integrada de encadenar o ramificar.",
      },
      {
        icon: "project",
        title: "Carpetas de proyecto",
        desc: "Agrupa sesiones relacionadas bajo un proyecto. Las notas compartidas y los resultados recientes viajan con cada ejecución dentro de ese proyecto.",
        vs: "Otras plataformas: cada conversación está aislada, sin memoria compartida entre chats.",
      },
      {
        icon: "preset",
        title: "Preajustes reutilizables",
        desc: "Guarda una buena cadena de revisión como preajuste. Cárgala cuando necesites el mismo flujo de trabajo multimodelo de nuevo, sin reconstruir desde cero.",
        vs: "Otras plataformas: recrea la misma secuencia de prompts cada vez.",
      },
      {
        icon: "attach",
        title: "Archivos adjuntos",
        desc: "Adjunta texto, Word, imágenes o PDF a tu tarea. Los archivos se procesan en el servidor y se inyectan automáticamente en los prompts de todos los modelos.",
        vs: "Otras plataformas: el soporte de subida de archivos varía según el modelo, sin compartir archivos entre modelos.",
      },
    ],

    /* step-by-step guide */
    guideTitle: "Guía paso a paso",
    guideSubtitle: "Del registro a tu primer flujo de trabajo multi-IA en 8 pasos.",

    steps: [
      {
        num: "01",
        title: "Regístrate o inicia sesión",
        desc: "Crea tu cuenta con correo/contraseña o inicio de sesión de Google. Tus ajustes de proveedor, sesiones, resultados y preajustes están todos acotados a tu cuenta.",
        tip: 'Haz clic en "Comenzar" en la página de inicio para empezar una prueba gratuita al instante.',
      },
      {
        num: "02",
        title: "Revisa los modelos de IA disponibles",
        desc: "Los proveedores de IA (GPT, Claude, Gemini, Grok) están preconfigurados por la plataforma. Abre el banco de trabajo y revisa el panel de selección de modelos: los marcados como \"listo\" están disponibles para tus tareas de inmediato.",
        tip: "Todas las claves y credenciales de los proveedores las gestiona el administrador en el servidor. No necesitas configurar ninguna clave de API tú mismo.",
      },
      {
        num: "03",
        title: "Abre el banco de trabajo",
        desc: 'Haz clic en "Banco de trabajo" en el menú izquierdo. Este es tu espacio de trabajo principal, donde escribes tareas, seleccionas modelos, construyes flujos de trabajo y ves resultados.',
        tip: null,
      },
      {
        num: "04",
        title: "Escribe una tarea y selecciona modelos",
        desc: 'Escribe tu pregunta, solicitud de análisis o instrucción en el área de texto. Luego habilita los modelos de IA que quieras comparar activándolos en el panel "Selección de modelos". También puedes elegir un estilo de salida (detallado, breve, viñetas, tabla o centrado en resultados) para controlar el formato.',
        tip: "Usa el campo de instrucción adicional para añadir contexto, restricciones o criterios de evaluación opcionales. Adjunta archivos (texto, Word, imágenes, PDF) para entradas más ricas.",
      },
      {
        num: "05",
        title: "Ejecuta la comparación paralela",
        desc: 'Con el modo "Comparación paralela" seleccionado, haz clic en Ejecutar. Todos los modelos habilitados procesan la misma tarea simultáneamente. Los resultados aparecen como tarjetas individuales que muestran la salida, el uso de tokens, la latencia y el costo estimado.',
        tip: "Si un modelo falla, los demás resultados permanecen intactos. Los modelos fallidos muestran una tarjeta de error que puedes volver a ejecutar.",
      },
      {
        num: "06",
        title: "Construye una cadena de revisión secuencial",
        desc: 'Cambia al modo "Cadena de revisión secuencial". Agrega pasos donde cada uno apunta a un modelo y una acción específicos (generar, criticar, mejorar, resumir, verificar). Cada paso puede consumir la entrada original, el paso anterior o un resultado seleccionado.',
        tip: 'Cadena de ejemplo: Paso 1 GPT "Redactar" → Paso 2 Grok "Criticar" → Paso 3 Gemini "Mejorar" → Paso 4 Claude "Pulir".',
      },
      {
        num: "07",
        title: "Trabaja con los resultados",
        desc: 'Cada tarjeta de resultado es accionable. Haz clic en "Revisar con otro modelo" para ramificar, "Seguimiento" para continuar la conversación, "Marcar como final" para designar la mejor respuesta o "Volver a ejecutar" para regenerar.',
        tip: "Los resultados forman un árbol. Cada rama se convierte en un nuevo punto de partida para más trabajo.",
      },
      {
        num: "08",
        title: "Organiza con proyectos y preajustes",
        desc: "Crea carpetas de proyecto para agrupar sesiones relacionadas. Guarda cadenas de trabajo útiles como preajustes. Las sesiones dentro de un proyecto comparten contexto y resultados recientes automáticamente.",
        tip: "Carga un preajuste guardado desde el banco de trabajo para aplicar al instante una cadena de revisión probada a una nueva tarea.",
      },
    ],

    /* parallel compare tutorial */
    parallelTutorial: {
      title: "Comparación paralela — Tutorial paso a paso",
      subtitle:
        "¡Envía tu pregunta a varios modelos de IA a la vez y compara sus respuestas lado a lado!",
      steps: [
        {
          num: "1",
          title: "Selecciona el modo Comparación paralela",
          desc: 'En la parte superior del banco de trabajo, haz clic en "Comparación paralela". El botón se ilumina para mostrar que está seleccionado.',
        },
        {
          num: "2",
          title: "Activa tus modelos de IA",
          desc: "En la lista de modelos verás: GPT, Claude, Gemini y Grok. Haz clic en la casilla junto a cada modelo que quieras usar. ¡Prueba a elegir 2 o 3!",
        },
        {
          num: "3",
          title: "Escribe tu pregunta",
          desc: 'Haz clic en el cuadro de texto grande y escribe tu pregunta. Ejemplo: "Explica por qué el cielo es azul con palabras sencillas."',
        },
        {
          num: "4",
          title: "Elige un estilo de salida (opcional)",
          desc: 'Elige cómo quieres el formato de las respuestas: Detallado (largo), Breve (corto), Viñetas (lista), Tabla (cuadrícula) o Centrado en resultados (resumen). ¿No estás seguro? Déjalo en "Detallado".',
        },
        {
          num: "5",
          title: "Adjunta archivos si lo necesitas (opcional)",
          desc: "Haz clic en el botón de adjuntar para añadir documentos de Word, imágenes, PDF o archivos de texto. Todos los modelos de IA seleccionados leerán tus archivos automáticamente.",
        },
        {
          num: "6",
          title: "Pulsa el botón Ejecutar",
          desc: '¡Haz clic en el botón verde "▶ Ejecutar". Todos tus modelos de IA seleccionados empiezan a trabajar en tu pregunta al mismo tiempo!',
        },
        {
          num: "7",
          title: "Espera un momento",
          desc: "Cada modelo muestra un indicador de progreso. Todos piensan simultáneamente: normalmente solo toma unos segundos.",
        },
        {
          num: "8",
          title: "¡Compara los resultados!",
          desc: "Los resultados aparecen como tarjetas, una por modelo de IA. Léelas lado a lado para ver cómo respondió cada IA de forma diferente. Cada tarjeta también muestra el tiempo empleado y los tokens usados.",
        },
      ],
    },

    /* sequential review chain tutorial */
    sequentialTutorial: {
      title: "Cadena de revisión secuencial — Tutorial paso a paso",
      subtitle:
        "¡Los modelos de IA trabajan como un equipo de relevos: cada uno lee y mejora la respuesta anterior!",
      steps: [
        {
          num: "1",
          title: "Selecciona el modo Cadena de revisión secuencial",
          desc: 'En la parte superior del banco de trabajo, haz clic en "Cadena de revisión secuencial". La pantalla cambia para mostrar una cadena de pasos conectados.',
        },
        {
          num: "2",
          title: "Mira la cadena predeterminada",
          desc: "Verás 3 pasos ya configurados: Paso 1 (GPT → Generar) → Paso 2 (Grok → Criticar) → Paso 3 (Gemini → Mejorar). ¡Esta es tu cadena inicial!",
        },
        {
          num: "3",
          title: "Personaliza cada paso",
          desc: 'Para cada paso puedes elegir: qué modelo de IA (menú desplegable), qué acción (Generar, Criticar, Mejorar, Resumir, Verificar, Simplificar) y añadir instrucciones especiales como "Concéntrate en errores gramaticales."',
        },
        {
          num: "4",
          title: "Agrega o quita pasos",
          desc: '¡Haz clic en "+" para añadir un nuevo paso al final. Haz clic en el icono de papelera para quitar un paso. Puedes tener tantos como quieras!',
        },
        {
          num: "5",
          title: "Escribe tu pregunta inicial",
          desc: 'En el cuadro de texto, escribe la pregunta para que el Paso 1 trabaje en ella. Ejemplo: "Escribe un cuento corto sobre un robot que aprende a pintar."',
        },
        {
          num: "6",
          title: "Pulsa el botón Ejecutar",
          desc: 'Haz clic en el botón verde "▶ Ejecutar". La cadena empieza a ejecutarse desde el Paso 1.',
        },
        {
          num: "7",
          title: "Observa cómo trabaja la cadena",
          desc: "El Paso 1 se ejecuta primero y crea una respuesta. Esa respuesta pasa automáticamente al Paso 2, que hace su trabajo (como criticar). Luego el resultado del Paso 2 pasa al Paso 3, y así sucesivamente, ¡como una carrera de relevos!",
        },
        {
          num: "8",
          title: "¡Mira todos los resultados!",
          desc: "Cuando la cadena termina, puedes leer la salida de cada paso. El último paso tiene la respuesta final y pulida. Haz clic en cualquier paso para ver lo que escribió esa IA.",
        },
      ],
    },

    /* features overview */
    featuresTitle: "Resumen de funciones",
    features: [
      { label: "Modelos compatibles", value: "GPT, Claude, Gemini, Grok (16 variantes de modelo)" },
      { label: "Modos de flujo de trabajo", value: "Comparación paralela y cadena de revisión secuencial" },
      { label: "Acciones", value: "Generar, lluvia de ideas, criticar, verificar, mejorar, resumir, simplificar, revisión de consistencia, revisión de código, seguimiento" },
      { label: "Adjuntos", value: "Texto, Word, imagen, PDF — procesamiento en el servidor" },
      { label: "Idiomas", value: "Inglés, coreano, japonés y español (cambiables en cualquier momento)" },
      { label: "Seguridad", value: "Credenciales cifradas, cookies HttpOnly, llamadas a IA solo del lado del servidor" },
    ],

    /* FAQ */
    faqTitle: "Preguntas frecuentes",
    faqs: [
      {
        q: "¿Mis datos están seguros?",
        a: "Sí. Todas las llamadas a la IA ocurren solo en el servidor: tus entradas nunca van directamente a proveedores externos desde tu navegador. Las sesiones usan cookies HttpOnly y todas las credenciales están cifradas.",
      },
      {
        q: "¿Puedo usar Yapp en el móvil?",
        a: "Sí. El banco de trabajo es totalmente adaptable, con una barra de navegación inferior optimizada para móvil y paneles plegables para modelos, entrada, flujo de trabajo y resultados.",
      },
      {
        q: "¿Qué tipos de archivos puedo adjuntar?",
        a: "Archivos de texto (.txt, .md, .csv), JSON, documentos de Word (.docx), documentos PDF e imágenes (.png, .jpg, .webp, .gif). Los archivos se procesan en el servidor y se incluyen en los prompts de todos los modelos.",
      },
      {
        q: "¿Qué pasa si un modelo de IA falla durante una ejecución?",
        a: "Los demás modelos continúan normalmente. El modelo fallido muestra una tarjeta de error que puedes volver a ejecutar individualmente sin repetir todo el flujo de trabajo.",
      },
    ],

    /* bottom CTA */
    ctaTitle: "¿Listo para empezar?",
    ctaSubtitle:
      "Experimenta la orquestación de varios modelos de IA en un flujo de trabajo unificado.",

    /* footer */
    version: "Versión",
    copyright: "Yapp by Wideget",
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
    <main className="min-h-screen bg-[#ffffff] text-stone-950">
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
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
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
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">
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
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">
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
        {/*  PARALLEL COMPARE TUTORIAL                                 */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-28">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">
              {t.parallelTutorial.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-base text-stone-600">
              {t.parallelTutorial.subtitle}
            </p>

            {/* ── Mock Screen Preview ── */}
            <div className="mt-10 overflow-hidden rounded-2xl border-2 border-teal-200 bg-white shadow-lg">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-medium text-stone-400">
                  Yapp Workbench
                </span>
              </div>

              <div className="space-y-3.5 p-5">
                {/* Mode selector */}
                <div className="flex gap-2">
                  <span className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
                    {localize(language, {
                      en: "● Parallel Compare",
                      ko: "● 병렬 비교",
                      ja: "● 並列比較",
                      es: "● Comparación paralela",
                    })}
                  </span>
                  <span className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-xs text-stone-400">
                    {localize(language, {
                      en: "Sequential Review Chain",
                      ko: "순차 검토 체인",
                      ja: "順次レビューチェーン",
                      es: "Cadena de revisión secuencial",
                    })}
                  </span>
                </div>

                {/* Model toggles */}
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                    ☑ GPT
                  </span>
                  <span className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                    ☑ Claude
                  </span>
                  <span className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                    ☑ Gemini
                  </span>
                  <span className="rounded-md border border-stone-200 px-2.5 py-1 text-xs text-stone-400">
                    ☐ Grok
                  </span>
                </div>

                {/* Input area */}
                <div className="rounded-lg border border-stone-200 bg-[#fafbf7] px-3.5 py-2.5 text-xs italic text-stone-400">
                  {localize(language, {
                    en: '"Explain why the sky is blue in simple words."',
                    ko: '"하늘이 파란 이유를 쉽게 설명해줘."',
                    ja: '"空が青い理由をわかりやすく説明して。"',
                    es: '"Explica por qué el cielo es azul con palabras sencillas."',
                  })}
                </div>

                {/* Output style */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-stone-500">
                    {localize(language, {
                      en: "Output Style:",
                      ko: "출력 스타일:",
                      ja: "出力スタイル:",
                      es: "Estilo de salida:",
                    })}
                  </span>
                  <span className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[10px] text-stone-600">
                    Detailed ▾
                  </span>
                </div>

                {/* Run button */}
                <div className="text-center">
                  <span className="inline-block rounded-lg bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-sm">
                    {localize(language, {
                      en: "▶ Run",
                      ko: "▶ 실행",
                      ja: "▶ 実行",
                      es: "▶ Ejecutar",
                    })}
                  </span>
                </div>

                {/* Result cards */}
                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        name: "GPT",
                        border: "border-blue-200",
                        bg: "bg-blue-50/60",
                        text: "text-blue-700",
                        line: "bg-blue-200",
                      },
                      {
                        name: "Claude",
                        border: "border-violet-200",
                        bg: "bg-violet-50/60",
                        text: "text-violet-700",
                        line: "bg-violet-200",
                      },
                      {
                        name: "Gemini",
                        border: "border-emerald-200",
                        bg: "bg-emerald-50/60",
                        text: "text-emerald-700",
                        line: "bg-emerald-200",
                      },
                    ] as const
                  ).map((m) => (
                    <div
                      key={m.name}
                      className={`rounded-lg border ${m.border} ${m.bg} p-2.5`}
                    >
                      <p className={`text-[10px] font-bold ${m.text}`}>
                        {m.name}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        <div className={`h-1.5 rounded-full ${m.line}`} />
                        <div
                          className={`h-1.5 w-4/5 rounded-full ${m.line}`}
                        />
                        <div
                          className={`h-1.5 w-3/5 rounded-full ${m.line}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Tutorial Steps ── */}
            <div className="mt-8 space-y-3">
              {t.parallelTutorial.steps.map((s) => (
                <div
                  key={s.num}
                  className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
                    {s.num}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-stone-900">{s.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/*  SEQUENTIAL REVIEW CHAIN TUTORIAL                          */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section className="mt-28">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">
              {t.sequentialTutorial.title}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-base text-stone-600">
              {t.sequentialTutorial.subtitle}
            </p>

            {/* ── Mock Screen Preview ── */}
            <div className="mt-10 overflow-hidden rounded-2xl border-2 border-teal-200 bg-white shadow-lg">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-medium text-stone-400">
                  Yapp Workbench
                </span>
              </div>

              <div className="space-y-3.5 p-5">
                {/* Mode selector */}
                <div className="flex gap-2">
                  <span className="rounded-lg border border-stone-200 px-3.5 py-1.5 text-xs text-stone-400">
                    {localize(language, {
                      en: "Parallel Compare",
                      ko: "병렬 비교",
                      ja: "並列比較",
                      es: "Comparación paralela",
                    })}
                  </span>
                  <span className="rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm">
                    {localize(language, {
                      en: "● Sequential Review Chain",
                      ko: "● 순차 검토 체인",
                      ja: "● 順次レビューチェーン",
                      es: "● Cadena de revisión secuencial",
                    })}
                  </span>
                </div>

                {/* Chain diagram */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-800">
                    GPT:{" "}
                    {localize(language, {
                      en: "Generate",
                      ko: "생성",
                      ja: "生成",
                      es: "Generar",
                    })}
                  </span>
                  <span className="text-lg text-stone-300">→</span>
                  <span className="rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1.5 text-[11px] font-medium text-orange-800">
                    Grok:{" "}
                    {localize(language, {
                      en: "Critique",
                      ko: "비판",
                      ja: "批評",
                      es: "Crítica",
                    })}
                  </span>
                  <span className="text-lg text-stone-300">→</span>
                  <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-800">
                    Gemini:{" "}
                    {localize(language, {
                      en: "Improve",
                      ko: "개선",
                      ja: "改善",
                      es: "Mejorar",
                    })}
                  </span>
                  <span className="rounded-md border border-dashed border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-400">
                    +{" "}
                    {localize(language, {
                      en: "Add",
                      ko: "추가",
                      ja: "追加",
                      es: "Agregar",
                    })}
                  </span>
                </div>

                {/* Input area */}
                <div className="rounded-lg border border-stone-200 bg-[#fafbf7] px-3.5 py-2.5 text-xs italic text-stone-400">
                  {localize(language, {
                    en: '"Write a short story about a robot who learns to paint."',
                    ko: '"그림 그리는 법을 배우는 로봇에 대한 짧은 이야기를 써줘."',
                    ja: '"絵を描くことを学ぶロボットについての短い物語を書いて。"',
                    es: '"Escribe un cuento corto sobre un robot que aprende a pintar."',
                  })}
                </div>

                {/* Run button */}
                <div className="text-center">
                  <span className="inline-block rounded-lg bg-emerald-600 px-6 py-2 text-xs font-bold text-white shadow-sm">
                    {localize(language, {
                      en: "▶ Run",
                      ko: "▶ 실행",
                      ja: "▶ 実行",
                      es: "▶ Ejecutar",
                    })}
                  </span>
                </div>

                {/* Chain execution preview */}
                <div className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5">
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    Step 1 ✓
                  </span>
                  <span className="text-xs text-stone-300">→</span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    Step 2 ✓
                  </span>
                  <span className="text-xs text-stone-300">→</span>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    Step 3 ⏳
                  </span>
                </div>
              </div>
            </div>

            {/* ── Tutorial Steps ── */}
            <div className="mt-8 space-y-3">
              {t.sequentialTutorial.steps.map((s) => (
                <div
                  key={s.num}
                  className="flex gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-teal-600 text-sm font-bold text-white">
                    {s.num}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-stone-900">{s.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      {s.desc}
                    </p>
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
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">
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
          <h2 className="text-center font-serif text-3xl font-semibold tracking-tight">
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
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
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
