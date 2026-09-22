import { getUser } from "@/lib/auth";
import { AppFrame } from "@/components/app/AppFrame";

/**
 * Pages under (open) work with or without a session. A guest takes the same
 * lessons as anyone else; what they answer is kept only on their device, until
 * they sign in and it joins their account (see lib/client-sync.ts).
 *
 * Anything that only makes sense with saved progress belongs under (app),
 * whose layout enforces sign-in.
 */
export default async function OpenLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return <AppFrame user={user}>{children}</AppFrame>;
}
