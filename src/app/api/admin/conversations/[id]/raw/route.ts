import { NextResponse } from "next/server";
import {
  adminApiErrorResponse,
  getRequestMeta,
  requireApiAdminViewer,
} from "@/lib/admin-api-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { decryptTextContent } from "@/lib/secret-crypto";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdminViewer();
    const { id } = await context.params;
    const meta = getRequestMeta(request);
    const body = (await request.json().catch(() => ({}))) as {
      accessReasonCode?: string;
    };

    const session = await prisma.workbenchSession.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        results: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            provider: true,
            model: true,
            outputText: true,
            outputTextCiphertext: true,
            outputTextIv: true,
            outputTextTag: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const reason = body.accessReasonCode?.trim() || "raw_view";

    await prisma.adminContentAccessLog.create({
      data: {
        adminUserId: admin.id,
        viewedUserId: session.userId,
        conversationId: session.id,
        accessReasonCode: reason,
      },
    });

    await logAdminAudit({
      adminUserId: admin.id,
      action: "CONTENT_RAW_VIEW",
      targetType: "conversation",
      targetId: session.id,
      detail: {
        viewedUserId: session.userId,
        reason,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const decryptedOriginalInput =
      session.originalInputCiphertext &&
      session.originalInputIv &&
      session.originalInputTag
        ? decryptTextContent({
            ciphertext: session.originalInputCiphertext,
            iv: session.originalInputIv,
            tag: session.originalInputTag,
          })
        : session.originalInput;

    const rawResults = session.results.map((result) => {
      const outputText =
        result.outputTextCiphertext &&
        result.outputTextIv &&
        result.outputTextTag
          ? decryptTextContent({
              ciphertext: result.outputTextCiphertext,
              iv: result.outputTextIv,
              tag: result.outputTextTag,
            })
          : result.outputText;

      return {
        id: result.id,
        provider: result.provider,
        model: result.model,
        outputText,
        errorMessage: result.errorMessage,
        createdAt: result.createdAt,
      };
    });

    return NextResponse.json({
      raw: {
        conversationId: session.id,
        user: session.user,
        originalInput: decryptedOriginalInput,
        results: rawResults,
      },
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
