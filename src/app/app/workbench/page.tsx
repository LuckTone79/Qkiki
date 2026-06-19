import { WorkbenchClient } from "@/components/workbench/WorkbenchClient";
import { AppRouteLoading } from "@/components/AppRouteLoading";
import { Suspense } from "react";

type WorkbenchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkbenchPage(props: WorkbenchPageProps) {
  const searchParams = await props.searchParams;
  const isTrialMode = searchParams.trial === "true";

  return (
    <Suspense fallback={<AppRouteLoading variant="workbench" />}>
      <WorkbenchClient isTrialMode={isTrialMode} />
    </Suspense>
  );
}
