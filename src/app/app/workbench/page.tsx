import { WorkbenchClient } from "@/components/workbench/WorkbenchClient";
import { Suspense } from "react";

type WorkbenchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkbenchPage(props: WorkbenchPageProps) {
  const searchParams = await props.searchParams;
  const isTrialMode = searchParams.trial === "true";

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WorkbenchClient isTrialMode={isTrialMode} />
    </Suspense>
  );
}
