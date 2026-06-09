import { FeedbackBoardClient } from "@/components/feedback/FeedbackBoardClient";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FeedbackBoardPage() {
  await requireUser();
  return <FeedbackBoardClient />;
}
