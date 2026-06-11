type PricingPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

const cards = [
  {
    key: "starter",
    title: "Starter",
    price: "월 39,000원",
    subtitle: "1,800 크레딧 / 월",
    description: "개인 사용자가 병렬 비교와 짧은 순차 검토를 꾸준히 쓰기 좋은 기본 유료 플랜입니다.",
    details: ["일 300 크레딧", "일 100회 실행", "입력 20,000자"],
  },
  {
    key: "pro",
    title: "Pro",
    price: "월 129,000원",
    subtitle: "6,000 크레딧 / 월",
    description: "반복 순차 체인과 고성능 모델 검토를 자주 돌리는 전문가용 플랜입니다.",
    details: ["일 1,000 크레딧", "일 300회 실행", "입력 100,000자"],
  },
  {
    key: "team",
    title: "Team",
    price: "월 399,000원",
    subtitle: "20,000 크레딧 / 월",
    description: "여러 사람이 공유 프로젝트와 장문 검토를 운영하는 팀용 플랜입니다.",
    details: ["일 3,500 크레딧", "일 600회 실행", "입력 100,000자"],
  },
  {
    key: "credit",
    title: "Credit Pack",
    price: "110,000원",
    subtitle: "10,000 충전 크레딧",
    description: "월 한도를 넘는 피크 사용이나 단기 프로젝트를 위한 추가 충전권입니다.",
    details: ["월 플랜 이후 자동 사용", "쿠폰 크레딧 이후 사용", "유효기간 12개월 예정"],
  },
];

export default async function PricingPage(props: PricingPageProps) {
  const searchParams = await props.searchParams;
  const intent = searchParams.intent;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Qkiki Pricing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
          Qkiki 크레딧 구독
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
          모든 AI 실행은 시작 전 예상 크레딧을 먼저 보여주고, 실제 정산은 승인된 예상치를 넘지 않게 처리합니다.
          1크레딧은 환율과 운영 리스크를 포함해 API 원가의 2배 이상을 보호하도록 설계했습니다.
        </p>
        {intent ? (
          <p className="mt-4 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            선택한 진입 경로: {intent}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.key}
            className={`rounded-lg border bg-white p-5 shadow-sm ${
              intent === card.key || (intent === "monthly" && card.key === "starter")
                ? "border-teal-400"
                : "border-stone-200"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              {card.subtitle}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">{card.title}</h2>
            <p className="mt-2 text-2xl font-semibold text-teal-800">{card.price}</p>
            <p className="mt-3 text-sm leading-6 text-stone-600">{card.description}</p>
            <ul className="mt-5 space-y-2 text-sm text-stone-700">
              {card.details.map((detail) => (
                <li key={detail} className="rounded-md bg-[#f7f6f3] px-3 py-2">
                  {detail}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">운영 기준</h2>
        <p className="mt-2">
          월 정액 크레딧을 먼저 사용하고, 7일 크레딧 쿠폰과 충전 크레딧은 잔액으로 표시됩니다.
          주간 크레딧 쿠폰은 관리자가 발행 수량을 직접 입력할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
