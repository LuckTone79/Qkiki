import { notFound } from "next/navigation";
import {
  FeedbackThreadClient,
  type FeedbackThreadData,
} from "@/components/feedback/FeedbackThreadClient";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FeedbackThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const post = await prisma.feedbackPost.findFirst({
    where: { id, userId: user.id },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!post) {
    notFound();
  }

  if (post.userUnread) {
    await prisma.feedbackPost.update({
      where: { id: post.id },
      data: { userUnread: false },
    });
  }

  const data: FeedbackThreadData = {
    id: post.id,
    title: post.title,
    body: post.body,
    category: post.category,
    status: post.status,
    createdAt: post.createdAt.toISOString(),
    comments: post.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      isAdmin: comment.isAdmin,
      authorName: comment.isAdmin
        ? "Qkiki"
        : comment.author.name || comment.author.email,
      createdAt: comment.createdAt.toISOString(),
    })),
  };

  return <FeedbackThreadClient post={data} />;
}
