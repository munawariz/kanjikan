import { getUser } from "@/lib/supabase/server";
import { AppFrame } from "@/components/app/AppFrame";

/**
 * Pages under (open) work with or without a session. A guest takes the same
 * lessons as anyone else; nothing they answer is written anywhere, and the
 * shell tells them so.
 *
 * Anything that only makes sense with saved progress belongs under (app),
 * whose layout enforces sign-in.
 */
export default async function OpenLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return <AppFrame user={user}>{children}</AppFrame>;
}
