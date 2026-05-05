import { prisma } from "@/lib/prisma";
import { AdminUsersClient, type UserRow } from "@/components/admin/AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      subscription: {
        select: { isLifetime: true, planEndsAt: true },
      },
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true },
      },
    },
  });

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: (user.lastActiveAt || user.sessions[0]?.updatedAt || user.createdAt).toISOString(),
    subscription: user.subscription
      ? {
          isLifetime: user.subscription.isLifetime,
          planEndsAt: user.subscription.planEndsAt?.toISOString() ?? null,
        }
      : null,
  }));

  return <AdminUsersClient users={rows} q={q || ""} />;
}
