export type IntentPrefetchRouter = {
  prefetch: (href: string) => void;
};

export function isIntentPrefetchHref(href: string) {
  return href.startsWith("/app/");
}

export function prefetchOnIntent(
  router: IntentPrefetchRouter,
  href: string,
) {
  if (!isIntentPrefetchHref(href)) {
    return;
  }

  router.prefetch(href);
}
