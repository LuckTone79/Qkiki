import { NextResponse } from "next/server";
import crypto from "crypto";
import { cookies } from "next/headers";
import { TRIAL_COOKIE } from "@/lib/auth-constants";

function getTrialSecret() {
  return process.env.APP_SECRET || "dev-only-change-before-production";
}

export async function POST() {
  const trialId = `trial-${crypto.randomBytes(8).toString("hex")}`;
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = Buffer.from(JSON.stringify({ id: trialId, exp })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getTrialSecret())
    .update(payload)
    .digest("base64url");
  const token = `${payload}.${sig}`;

  const cookieStore = await cookies();
  cookieStore.set(TRIAL_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(exp),
    path: "/",
  });

  return NextResponse.json({ success: true, redirectUrl: "/app/workbench?trial=true" });
}
