import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <AdminDashboardClient
      metrics={data.metrics}
      providerUsage={data.providerUsageRows}
      modelUsage={data.modelUsageRows}
      topUserRows={data.topUserRows}
      recentAudits={data.recentAudits}
    />
  );
}
