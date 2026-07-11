import { AdminCouponsClient } from "@/components/admin/AdminCouponsClient";
import { requireAdminManagerPage } from "@/lib/admin-page-auth";

export default async function AdminCouponsPage() {
  await requireAdminManagerPage();
  return <AdminCouponsClient />;
}
