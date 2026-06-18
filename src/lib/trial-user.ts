export const TRIAL_EMAIL_DOMAIN = "@trial.local";

type TrialUserLike = {
  email?: string | null;
  isTrial?: boolean | null;
};

export function isTrialUserLike(user: TrialUserLike | null | undefined) {
  if (!user) {
    return false;
  }

  return (
    user.isTrial === true ||
    (typeof user.email === "string" && user.email.endsWith(TRIAL_EMAIL_DOMAIN))
  );
}

export function shouldShowAuthEntryPoints(
  user: TrialUserLike | null | undefined,
) {
  return !user || isTrialUserLike(user);
}
