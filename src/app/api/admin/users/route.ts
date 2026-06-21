import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { getAdminUserList, normalizeUserSort } from "@/lib/admin-users";

export async function GET(request: Request) {
  try {
    await requireApiAdminViewer();

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const sort = normalizeUserSort(url.searchParams.get("sort") ?? undefined);
    const all = url.searchParams.get("all") === "1";

    const users = await getAdminUserList({
      q,
      sort,
      limit: all ? Number.MAX_SAFE_INTEGER : 100,
    });

    return NextResponse.json({ users });
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
