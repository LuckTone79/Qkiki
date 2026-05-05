import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth-constants";

export async function POST() {
  try {
    // Create a temporary trial user
    const trialEmail = `trial-${crypto.randomBytes(8).toString("hex")}@trial.local`;
    const trialPassword = crypto.randomBytes(32).toString("base64url");

    const user = await prisma.user.create({
      data: {
        email: trialEmail,
        name: "Trial User",
        passwordHash: trialPassword,
        role: "USER",
        status: "ACTIVE",
      },
    });

    // Create auth session
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day

    await prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      path: "/",
    });

    return NextResponse.json(
      {
        success: true,
        redirectUrl: "/app/workbench?trial=true",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Trial session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create trial session" },
      { status: 500 }
    );
  }
}
