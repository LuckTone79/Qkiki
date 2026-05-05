import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import { getUserSubscriptionState } from "@/lib/subscription";

export async function GET() {
  try {
    const user = await requireApiUser();
    const subscription = await getUserSubscriptionState(user.id);

    return NextResponse.json({ subscription });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
