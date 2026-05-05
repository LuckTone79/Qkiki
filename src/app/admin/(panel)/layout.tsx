import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminViewer } from "@/lib/admin-auth";

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminViewer();

  return <AdminShell admin={admin}>{children}</AdminShell>;
}
