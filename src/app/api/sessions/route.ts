import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { listSessionsForUser } from "@/server/app-data/sessions";
import { createRouteTiming } from "@/server/perf/route-timing";

export async function GET() {
  const timing = createRouteTiming();

  try {
    const user = await timing.time("auth", () => requireApiUser());
    const sessions = await timing.query("session_list", () =>
      listSessionsForUser(user.id),
    );

    return timing.response(NextResponse.json({ sessions }));
  } catch (error) {
    return timing.response(apiErrorResponse(error));
  }
}
