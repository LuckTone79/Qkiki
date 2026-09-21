import { NextResponse } from "next/server";
import { ensureLegacyUserLinked } from "@/lib/supabase/link-legacy-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes the app-owned Supabase UUID -> Prisma CUID bridge immediately
 * after email/password auth. OAuth/email callbacks use the same bridge in
 * `src/app/auth/callback/route.ts`.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return NextResponse.json({ code: "INVALID_SESSION" }, { status: 401 });
  }

  try {
    const user = await ensureLegacyUserLinked(data.user);
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    await supabase.auth.signOut();
    const code = error instanceof Error && "code" in error
      ? String((error as Error & { code?: string }).code)
      : "IDENTITY_MAPPING_FAILED";
    return NextResponse.json(
      { code },
      { status: code === "IDENTITY_LINK_CONFLICT" ? 409 : 422 },
    );
  }
}
