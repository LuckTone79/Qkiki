import { getAdminUserList, normalizeUserSort } from "@/lib/admin-users";
import { AdminUsersClient } from "@/components/admin/AdminUsersClient";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q, sort } = await searchParams;
  const normalizedSort = normalizeUserSort(sort);

  const rows = await getAdminUserList({ q, sort: normalizedSort });

  return <AdminUsersClient users={rows} q={q || ""} sort={normalizedSort} />;
}
