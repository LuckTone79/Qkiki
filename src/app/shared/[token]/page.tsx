import { notFound } from "next/navigation";
import { SharedSessionView } from "@/components/share/SharedSessionView";
import { getSharedSessionPayload } from "@/lib/shared-links";

type SharedPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function SharedPage(props: SharedPageProps) {
  const [{ token }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const payload = await getSharedSessionPayload(token);

  if (!payload) {
    notFound();
  }

  const focusedResultId =
    typeof searchParams.result === "string" ? searchParams.result : null;

  return (
    <main className="min-h-screen bg-[#ffffff]">
      <SharedSessionView payload={payload} focusedResultId={focusedResultId} />
    </main>
  );
}
