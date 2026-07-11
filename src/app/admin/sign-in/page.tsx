import { redirect } from "next/navigation";
import { AdminSignInCard } from "@/components/admin/AdminSignInCard";
import { getCurrentAdmin } from "@/lib/admin-auth";

export default async function AdminSignInPage() {
  const admin = await getCurrentAdmin();
  if (admin) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5 py-10">
      <AdminSignInCard />
    </main>
  );
}
