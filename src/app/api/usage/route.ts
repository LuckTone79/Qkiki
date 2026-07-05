import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { getUsageStatus } from "@/lib/usage-policy";
import { createServerTiming } from "@/server/perf/server-timing";

export async function GET() {
  const timing = createServerTiming();
  try {
    const user = await timing.measure("auth", () => requireApiUser());
    const usage = await timing.measure("usage", () => getUsageStatus(user.id));

    const response = NextResponse.json({ usage });
    timing.apply(response.headers);
    return response;
  } catch (error) {
    const response = apiErrorResponse(error);
    timing.apply(response.headers);
    return response;
  }
}
