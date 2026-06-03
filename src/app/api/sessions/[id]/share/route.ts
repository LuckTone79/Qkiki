import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import {
  buildSharedLinkResponse,
  getOrCreateSharedLink,
  verifySharedResultBelongsToSession,
} from "@/lib/shared-links";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      resultId?: string;
    };

    const sharedLink = await getOrCreateSharedLink({
      userId: user.id,
      sessionId: id,
    });

    if (body.resultId) {
      const valid = await verifySharedResultBelongsToSession({
        sessionId: id,
        resultId: body.resultId,
      });

      if (!valid) {
        return NextResponse.json(
          { error: "Result does not belong to this session." },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      buildSharedLinkResponse({
        token: sharedLink.token,
        resultId: body.resultId ?? null,
      }),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
