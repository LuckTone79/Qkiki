import { AccountClient } from "@/components/account/AccountClient";
import { requireUser } from "@/lib/auth";

export default async function AccountPage() {
  const user = await requireUser();
  return <AccountClient initialName={user.name || ""} email={user.email} />;
}
