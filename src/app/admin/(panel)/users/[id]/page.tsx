import { notFound } from "next/navigation";
import { requireAdminViewer } from "@/lib/admin-auth";
import { logAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";
import { AdminUserDetailClient, type UserDetailData } from "@/components/admin/AdminUserDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdminViewer();
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          mode: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { results: true } },
        },
      },
      couponRedemptions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          coupon: { select: { code: true, type: true } },
        },
      },
    },
  });

  if (!user) notFound();

  await logAdminAudit({
    adminUserId: admin.id,
    action: "USER_DETAIL_VIEW",
    targetType: "user",
    targetId: user.id,
  });

  const data: UserDetailData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    sessions: user.sessions.map((s) => ({
      id: s.id,
      title: s.title ?? "",
      mode: s.mode,
      updatedAt: s.updatedAt.toISOString(),
      resultCount: s._count.results,
    })),
    couponRedemptions: user.couponRedemptions.map((item) => ({
      id: item.id,
      couponCode: item.coupon.code,
      couponType: item.coupon.type,
      result: item.result,
      note: item.note,
      createdAt: item.createdAt.toISOString(),
    })),
    subscription: user.subscription
      ? {
          isLifetime: user.subscription.isLifetime,
          planEndsAt: user.subscription.planEndsAt?.toISOString() ?? null,
        }
      : null,
  };

  return <AdminUserDetailClient user={data} />;
}
