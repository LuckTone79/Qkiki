import "server-only";

import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { grantWelcomeBoostToUser } from "@/lib/usage-policy";

export function getInitialRoleForEmail(_email: string): UserRole {
  // Email verification is not an administrator bootstrap mechanism. Promote
  // the initial administrator only through the offline launch runbook.
  return UserRole.USER;
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

/**
 * Resolves the legacy Prisma `User` row for an authenticated Supabase user,
 * creating or linking one if this is their first session since migrating to
 * Supabase Auth. This is the one place that bridges the two identity systems
 * — every existing relation (coupons, subscriptions, credits, projects, ...)
 * keeps pointing at the returned row's `id`, unchanged.
 */
export async function ensureLegacyUserLinked(authUser: SupabaseAuthUser) {
  const linked = await prisma.user.findUnique({
    where: { supabaseUserId: authUser.id },
  });
  if (linked) {
    return linked;
  }

  const email = authUser.email?.trim().toLowerCase();
  if (!email) {
    throw new Error(
      `Supabase auth user ${authUser.id} has no email; cannot resolve a legacy account.`,
    );
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
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
    // sign-up at once) — link to it instead of failing the request.
    const raceWinner = await prisma.user.findUnique({ where: { email } });
    if (!raceWinner) {
      throw error;
    }
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
