import { AdminUsersClient } from "@/components/admin/AdminUsersClient";
import { getAdminUserRows, parseAdminUserListFilters } from "@/lib/admin-users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    status?: string;
    role?: string;
    all?: string;
  }>;
}) {
  const filters = parseAdminUserListFilters(await searchParams);
  const users = await getAdminUserRows(filters);

  return <AdminUsersClient users={users} filters={filters} />;
}
