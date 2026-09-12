import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AppFrame } from "@/components/app/AppFrame";

/**
 * Everything under (app) requires a session. The middleware already redirects
 * anonymous traffic; this second check is what makes that guarantee hold if the
 * matcher is ever narrowed.
 *
 * Pages a guest may use live under (open) instead.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  return <AppFrame user={user}>{children}</AppFrame>;
}
