type PricingPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

const cards = [
  {
    key: "monthly",
    title: "Starter Monthly",
    subtitle: "월구독",
    description: "매달 넉넉한 비교 횟수와 더 긴 입력 한도를 제공할 준비 중입니다.",
  },
  {
    key: "yearly",
    title: "Pro Yearly",
    subtitle: "연구독",
    description: "더 큰 한도와 할인 가격으로 장기 사용자를 위한 플랜을 준비 중입니다.",
  },
  {
    key: "credit",
    title: "Credit Pack",
    subtitle: "충전형",
    description: "필요한 만큼만 충전해서 쓰는 크레딧 방식도 곧 연결할 예정입니다.",
  },
];

export default async function PricingPage(props: PricingPageProps) {
  const searchParams = await props.searchParams;
  const intent = searchParams.intent;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Qkiki Pricing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
          결제 전환 페이지 준비 중입니다
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
          현재는 Usage Policy V1에 맞춘 업그레이드 동선만 먼저 연결되어 있습니다.
          실제 결제 연동 전까지는 아래 플랜 구조와 확장 방향을 미리 안내합니다.
        </p>
        {intent ? (
          <p className="mt-4 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            선택한 진입 경로: {intent}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.key}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              {card.subtitle}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">{card.description}</p>
            <div className="mt-6 rounded-lg border border-dashed border-stone-300 bg-[#fbfcf8] px-3 py-3 text-xs text-stone-500">
              실제 가격, 결제 수단, 영수증 흐름은 다음 단계에서 연결됩니다.
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
