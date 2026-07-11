type ApiAuthRedirectOptions = {
  status: number;
  redirectUrl?: string;
  returnTo: string;
};

function isSafeInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export function resolveApiAuthRedirect({
  status,
  redirectUrl,
  returnTo,
}: ApiAuthRedirectOptions) {
  if (status !== 401) {
    return null;
  }

  if (redirectUrl && isSafeInternalPath(redirectUrl)) {
    return redirectUrl;
  }

  const safeReturnTo =
    isSafeInternalPath(returnTo) && returnTo.startsWith("/app")
      ? returnTo
      : "/app/workbench";
  const params = new URLSearchParams({
    next: safeReturnTo,
    reason: "session_expired",
  });

  return `/sign-in?${params.toString()}`;
}
