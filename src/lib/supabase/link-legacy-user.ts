import "server-only";

import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grantWelcomeBoostToUser } from "@/lib/usage-policy";
import {
  assertIdentityLinkMayProceed,
  requireLegacyEmail,
} from "@/lib/supabase/identity-link-policy";
import { assertYappAuthSubject } from "../../../auth/wideget/adapter.mjs";

function getBootstrapAdminEmails() {
  return (process.env.INITIAL_ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getInitialRoleForEmail(email: string): UserRole {
  const normalized = email.trim().toLowerCase();
  return getBootstrapAdminEmails().includes(normalized)
    ? UserRole.SUPER_ADMIN
    : UserRole.USER;
}

function displayNameFromMetadata(authUser: SupabaseAuthUser) {
  const metadata = authUser.user_metadata as Record<string, unknown> | null;
  const candidate =
    (metadata?.display_name as string | undefined) ??
    (metadata?.full_name as string | undefined) ??
    (metadata?.name as string | undefined);
  return candidate?.trim().slice(0, 80) || null;
}

async function syncProfileRole(supabaseUserId: string, user: {
  role: UserRole;
  name: string | null;
}) {
  await prisma.profile
    .update({
      where: { userId: supabaseUserId },
      data: {
        role: user.role.toLowerCase(),
        displayName: user.name ?? undefined,
      },
    })
    .catch(() => {
      // The auth.users trigger creates this row; if it hasn't landed yet
      // (replication lag) there's nothing to sync to and nothing to fix here.
    });
}

async function findLegacyUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Resolves the legacy Prisma `User` row for an authenticated Supabase user,
 * creating or linking one if this is their first session since migrating to
 * Supabase Auth. This is the one place that bridges the two identity systems
 * — every existing relation (coupons, subscriptions, credits, projects, ...)
 * keeps pointing at the returned row's `id`, unchanged.
 */
export async function ensureLegacyUserLinked(authUser: SupabaseAuthUser) {
  assertYappAuthSubject(authUser.id);

  const linked = await prisma.user.findUnique({
    where: { supabaseUserId: authUser.id },
  });
  if (linked) {
    return linked;
  }

  const email = requireLegacyEmail(authUser.email);

  const existingByEmail = await findLegacyUserByEmail(email);
  if (existingByEmail) {
    assertIdentityLinkMayProceed(existingByEmail.supabaseUserId, authUser.id);
    const updated = existingByEmail.supabaseUserId
      ? existingByEmail
      : await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { supabaseUserId: authUser.id },
        });
    await syncProfileRole(authUser.id, updated);
    return updated;
  }

  const displayName = displayNameFromMetadata(authUser);
  let created;
  try {
    created = await prisma.user.create({
      data: {
        email,
        name: displayName,
        passwordHash: null,
        supabaseUserId: authUser.id,
        role: getInitialRoleForEmail(email),
      },
    });
  } catch (error) {
    // Concurrent request already created this row (e.g. two tabs completing
    // sign-up at once) — link to it only when ownership is still unambiguous.
    const raceWinner = await findLegacyUserByEmail(email);
    if (!raceWinner) {
      throw error;
    }
    assertIdentityLinkMayProceed(raceWinner.supabaseUserId, authUser.id);
    created = raceWinner.supabaseUserId
      ? raceWinner
      : await prisma.user.update({
          where: { id: raceWinner.id },
          data: { supabaseUserId: authUser.id },
        });
    await syncProfileRole(authUser.id, created);
    return created;
  }

  await grantWelcomeBoostToUser(created.id);
  await syncProfileRole(authUser.id, created);

  return created;
}
