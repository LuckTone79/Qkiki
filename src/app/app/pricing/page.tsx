import {
  QKIKI_CREDIT_PACK,
  QKIKI_PRICING_PLANS,
  type PaidPlanKey,
} from "@/lib/billing-plans";

type PricingPageProps = {
  searchParams: Promise<{ intent?: string }>;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

function isHighlighted(intent: string | undefined, key: PaidPlanKey | "credit") {
  if (intent === key) return true;
  if (intent === "monthly" && key === "starter") return true;
  if (intent === "yearly" && key === "pro") return true;
  if (intent === "credit" && key === "credit") return true;
  return false;
}

export default async function PricingPage(props: PricingPageProps) {
  const searchParams = await props.searchParams;
  const intent = searchParams.intent;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Yapp Pricing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
          USD 기준 크레딧 구독
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
          모든 한도는 횟수가 아니라 크레딧으로 통일했습니다. 최저 유료 플랜은
          ChatGPT Plus·Claude Pro의 월 $20대보다 낮은 월 $7.30입니다. 무료 사용자는
          하루 70크레딧, 비로그인 사용자는 하루 30크레딧이 제공됩니다.
        </p>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
          Entry pricing starts at $7.30/month. Everything is metered in credits —
          there is no separate per-run count. Free users get 70 credits/day, and
          signed-out visitors get 30 credits/day.
        </p>
        {intent ? (
          <p className="mt-4 inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            선택된 진입 경로: {intent}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {QKIKI_PRICING_PLANS.map((plan) => (
          <article
            key={plan.key}
            className={`rounded-lg border bg-white p-5 shadow-sm ${
              isHighlighted(intent, plan.key)
                ? "border-teal-400"
                : "border-stone-200"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              {plan.limits.monthlyCreditLimit.toLocaleString("en-US")} credits / month
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">{plan.title}</h2>
            <p className="mt-2 text-3xl font-semibold text-teal-800">
              {formatUsd(plan.monthlyPriceUsd)}
              <span className="text-sm font-medium text-stone-500"> / month</span>
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Annual: {formatUsd(plan.annualPriceUsd)} / year
            </p>
            <p className="mt-4 text-sm leading-6 text-stone-600">{plan.positioning}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{plan.positioningKo}</p>
            <ul className="mt-5 space-y-2 text-sm text-stone-700">
              <li className="rounded-md bg-[#f7f6f3] px-3 py-2">
                Monthly credits: {plan.limits.monthlyCreditLimit.toLocaleString("en-US")}
              </li>
              <li className="rounded-md bg-[#f7f6f3] px-3 py-2">
                Daily credit cap: {plan.limits.dailyCreditLimit.toLocaleString("en-US")}
              </li>
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Optional top-up
            </p>
            <h2 className="mt-2 text-xl font-semibold text-stone-950">
              {QKIKI_CREDIT_PACK.title}
            </h2>
            <p className="mt-2 text-3xl font-semibold text-teal-800">
              {formatUsd(QKIKI_CREDIT_PACK.priceUsd)}
            </p>
          </div>
          <div className="text-sm leading-7 text-stone-600">
            <p>
              Includes {QKIKI_CREDIT_PACK.credits.toLocaleString("en-US")} top-up credits,
              valid for {QKIKI_CREDIT_PACK.expiresInMonths} months.
            </p>
            <p className="mt-2">{QKIKI_CREDIT_PACK.positioning}</p>
            <p className="mt-2">{QKIKI_CREDIT_PACK.positioningKo}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600 shadow-sm">
        <h2 className="text-base font-semibold text-stone-950">운영 기준</h2>
        <p className="mt-2">
          모든 실행은 시작 전에 예상 크레딧을 먼저 보여주고, 실제 정산은 실행 후
          사용된 모델과 토큰을 기준으로 처리합니다. 긴 파일, 반복 체인, 고성능 모델은
          같은 월 구독 안에서도 더 빠르게 크레딧을 소모합니다.
        </p>
      </section>
    </div>
  );
}
