import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiUser } from "@/lib/api-auth";
import {
  buildSharedLinkResponse,
  createScopedSharedLink,
  revokeSharedLinks,
  verifySharedResultBelongsToSession,
} from "@/lib/shared-links";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { resultId?: unknown };
    const resultId = typeof body.resultId === "string" ? body.resultId : null;

    if (resultId) {
      const valid = await verifySharedResultBelongsToSession({ sessionId: id, resultId });
      if (!valid) {
        return NextResponse.json(
          { error: "Result does not belong to this session." },
          { status: 400, headers: PRIVATE_HEADERS },
        );
      }
    }

    const sharedLink = await createScopedSharedLink({
      userId: user.id,
      sessionId: id,
      resultId,
    });

    return NextResponse.json(
      buildSharedLinkResponse({
        token: sharedLink.token,
        expiresAt: sharedLink.expiresAt,
        resultId,
      }),
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const revoked = await revokeSharedLinks({ userId: user.id, sessionId: id });
    return NextResponse.json({ ok: true, revoked: revoked.count }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
