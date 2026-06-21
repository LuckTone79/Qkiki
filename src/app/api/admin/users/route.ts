import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { getAdminUserRows, parseAdminUserListFilters } from "@/lib/admin-users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireApiAdminViewer();

    const url = new URL(request.url);
    const filters = parseAdminUserListFilters({
      q: url.searchParams.get("q") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      all: url.searchParams.get("all") ?? undefined,
    });
    const users = await getAdminUserRows(filters);

    return NextResponse.json(
      { users, filters },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
