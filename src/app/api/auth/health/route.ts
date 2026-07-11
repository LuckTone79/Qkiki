import { NextResponse } from "next/server";
import { getAuthRuntimeDiagnostics } from "@/lib/auth-config";

// Health probes only need a boolean. Per-component diagnostics stay out of
// the public response so the endpoint cannot be used to map server
// configuration (which env vars are set) from the outside.
export async function GET() {
  const diagnostics = getAuthRuntimeDiagnostics();
  return NextResponse.json(
    {
      ok:
        diagnostics.databaseConfigured &&
        diagnostics.appSecretConfigured &&
        diagnostics.googleOAuthConfigured,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
