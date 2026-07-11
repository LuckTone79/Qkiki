import { NextResponse } from "next/server";

// Public probes are liveness-only. Dependency and environment readiness must
// stay behind authenticated operator tooling so this endpoint cannot become a
// deployment-configuration oracle.
export async function GET() {
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
