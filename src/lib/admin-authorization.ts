export type AccountRole = "USER" | "SUPPORT_VIEWER" | "ADMIN" | "SUPER_ADMIN";

export type AdminActor = {
  id: string;
  role: AccountRole;
};

export type AdminTarget = {
  id: string;
  role: AccountRole;
};

const ROLE_RANK: Record<AccountRole, number> = {
  USER: 0,
  SUPPORT_VIEWER: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

/**
 * Destructive account and session actions are deliberately restricted to a
 * super administrator acting on a lower-privileged, different account. This
 * prevents self-lockout and peer-admin takeover through the HTTP admin API.
 */
export function canAdminMutateUser(actor: AdminActor, target: AdminTarget) {
  return (
    actor.role === "SUPER_ADMIN" &&
    actor.id !== target.id &&
    ROLE_RANK[target.role] < ROLE_RANK[actor.role]
  );
}

