import { NextResponse } from "next/server";
import { getAuthRuntimeDiagnostics } from "@/lib/auth-config";

export async function GET() {
  const diagnostics = getAuthRuntimeDiagnostics();
  return NextResponse.json({
    ok:
      diagnostics.databaseConfigured &&
      diagnostics.appSecretConfigured &&
      diagnostics.googleOAuthConfigured,
    diagnostics,
  });
}
