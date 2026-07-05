export type PendingUsageAggregate = {
  _sum: {
    reservedRequestCount: number | null;
    reservedCreditCount: number | null;
  };
};

export function normalizePendingUsageAggregate(
  aggregate: PendingUsageAggregate,
) {
  return {
    reservedRequests: aggregate._sum.reservedRequestCount ?? 0,
    reservedCredits: aggregate._sum.reservedCreditCount ?? 0,
  };
}
