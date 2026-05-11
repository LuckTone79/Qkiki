import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { getUsageStatus } from "@/lib/usage-policy";

export async function GET() {
  try {
    const user = await requireApiUser();
    const usage = await getUsageStatus(user.id);

    return NextResponse.json({ usage });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
