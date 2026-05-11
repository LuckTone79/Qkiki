import { NextResponse } from "next/server";
import { adminApiErrorResponse, requireApiAdminViewer } from "@/lib/admin-api-auth";
import { getAdminDashboardData } from "@/lib/admin-dashboard";

export async function GET() {
  try {
    await requireApiAdminViewer();
    const data = await getAdminDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    return adminApiErrorResponse(error);
  }
}
