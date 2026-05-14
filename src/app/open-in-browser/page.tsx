import { OpenInBrowserClient } from "@/app/open-in-browser/OpenInBrowserClient";
import { sanitizeOpenInBrowserTarget } from "@/lib/browser-detection";

type OpenInBrowserPageProps = {
  searchParams: Promise<{
    target?: string;
  }>;
};

export default async function OpenInBrowserPage({
  searchParams,
}: OpenInBrowserPageProps) {
  const resolvedSearchParams = await searchParams;
  const targetPath = sanitizeOpenInBrowserTarget(
    resolvedSearchParams.target,
  );

  return <OpenInBrowserClient targetPath={targetPath} />;
}
