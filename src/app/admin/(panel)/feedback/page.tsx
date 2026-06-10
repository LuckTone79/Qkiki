import { AdminFeedbackClient } from "@/components/admin/AdminFeedbackClient";
import { requireAdminViewer } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireAdminViewer();
  return <AdminFeedbackClient />;
}
