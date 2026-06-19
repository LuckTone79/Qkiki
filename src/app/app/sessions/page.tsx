import { SessionsClient } from "@/components/sessions/SessionsClient";
import { requireUser } from "@/lib/auth";
import { listSessionsForUser } from "@/server/app-data/sessions";

export default async function SessionsPage() {
  const user = await requireUser();
  const sessions = await listSessionsForUser(user.id);

  return <SessionsClient initialSessions={sessions} initialLoaded />;
}
