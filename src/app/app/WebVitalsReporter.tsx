"use client";

import { useReportWebVitals } from "next/web-vitals";

const shouldReport = process.env.NEXT_PUBLIC_PERF_TRACE === "1";

const reportWebVitals: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  if (!shouldReport) {
    return;
  }

  console.info("[perf:web-vitals]", {
    id: metric.id,
    name: metric.name,
    rating: metric.rating,
    value: metric.value,
    delta: metric.delta,
    navigationType: metric.navigationType,
  });
};

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVitals);
  return null;
}
