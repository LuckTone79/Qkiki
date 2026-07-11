import { NextResponse } from "next/server";
import { clearAuthSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  // Also clears any legacy trial-session cookie (real users no longer set one).
  await clearAuthSession();
  return NextResponse.json({ ok: true });
}
