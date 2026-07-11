import { notFound } from "next/navigation";
import {
  AdminFeedbackDetailClient,
  type AdminFeedbackDetailData,
} from "@/components/admin/AdminFeedbackDetailClient";
import { canManageAdmin, requireAdminViewer } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { toFeedbackAttachmentMeta } from "@/lib/feedback";
import { AdminAuditAction } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminViewer();
  const canManage = canManageAdmin(admin.role);
  const { id } = await params;

  const post = await prisma.feedbackPost.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!post) {
    notFound();
  }

  if (post.adminUnread && canManage) {
    await prisma.feedbackPost.update({
      where: { id: post.id },
      data: { adminUnread: false },
    });
  }

  await logAdminAudit({
    adminUserId: admin.id,
    action: AdminAuditAction.FEEDBACK_VIEW,
    targetType: "feedback_post",
    targetId: post.id,
    detail: { viewedUserId: post.userId },
  });

  const data: AdminFeedbackDetailData = {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    user: {
      id: post.user.id,
      email: post.user.email,
      name: post.user.name,
    },
    attachments: post.attachments.map((attachment) => {
      const meta = toFeedbackAttachmentMeta(attachment);
      return { id: meta.id, name: meta.name, url: meta.url };
    }),
    comments: post.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      isAdmin: comment.isAdmin,
      authorName: comment.isAdmin
        ? "Yapp"
        : comment.author.name || comment.author.email,
      createdAt: comment.createdAt.toISOString(),
    })),
  };

  return <AdminFeedbackDetailClient post={data} canManage={canManage} />;
}
