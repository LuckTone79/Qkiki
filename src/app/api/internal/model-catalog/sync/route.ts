import { syncModelCatalog } from "@/lib/ai/sync-model-catalog";
import { verifyInternalWorkerRequest } from "@/lib/internal-worker-auth";
import { APP_VERSION } from "@/lib/version";

export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await verifyInternalWorkerRequest(request);
  if (!auth.ok) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const providers = await syncModelCatalog();
  const status = providers.some((provider) => provider.status === "failed") ? 503 : 200;
  console.info("[model-catalog] daily synchronization", { version: APP_VERSION, providers });
  return Response.json({ version: APP_VERSION, providers }, { status });
}
