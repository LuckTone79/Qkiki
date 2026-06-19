import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { getUsageStatus } from "@/lib/usage-policy";
import { createRouteTiming } from "@/server/perf/route-timing";

export async function GET() {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    const usage = await timing.query("usage_status", () => getUsageStatus(user.id));

    return timing.response(NextResponse.json({ usage }));
  } catch (error) {
    return timing.response(apiErrorResponse(error));
  }
}
