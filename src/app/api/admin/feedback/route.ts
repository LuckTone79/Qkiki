import { NextResponse } from "next/server";
import { FeedbackStatus } from "@prisma/client";
import {
  adminApiErrorResponse,
  requireApiAdminViewer,
} from "@/lib/admin-api-auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_STATUSES } from "@/lib/feedback";

export async function GET(request: Request) {
  try {
    await requireApiAdminViewer();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const statusParam = url.searchParams.get("status")?.trim() || "";
    const status =
      statusParam && (FEEDBACK_STATUSES as readonly string[]).includes(statusParam)
        ? (statusParam as FeedbackStatus)
        : null;

    const posts = await prisma.feedbackPost.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
                { user: { email: { contains: q, mode: "insensitive" } } },
                { user: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: [{ adminUnread: "desc" }, { updatedAt: "desc" }],
      take: 200,
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        adminUnread: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { comments: true, attachments: true } },
      },
    });

    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        category: post.category,
        status: post.status,
        isUnread: post.adminUnread,
        commentCount: post._count.comments,
        attachmentCount: post._count.attachments,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        user: {
          id: post.user.id,
          email: post.user.email,
          name: post.user.name,
        },
      })),
    });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
