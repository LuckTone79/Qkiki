import { AdminProvidersClient } from "@/components/admin/AdminProvidersClient";
import { requireAdminCriticalPage } from "@/lib/admin-page-auth";

export default async function AdminProvidersPage() {
  await requireAdminCriticalPage();
  return <AdminProvidersClient />;
}
