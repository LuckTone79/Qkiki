import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { listSessionsForUser } from "@/server/app-data/sessions";

export async function GET() {
  try {
    const user = await requireApiUser();
    const sessions = await listSessionsForUser(user.id);

    return NextResponse.json({ sessions });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
