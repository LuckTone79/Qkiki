import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [projects, recentSessions] = await Promise.all([
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true },
    }),
    prisma.workbenchSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 11,
      select: { id: true, title: true },
    }),
  ]);

  return (
    <AppShell user={user} projects={projects} recentSessions={recentSessions}>
      {children}
    </AppShell>
  );
}
