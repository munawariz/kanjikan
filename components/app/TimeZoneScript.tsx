import { TZ_COOKIE } from "@/lib/daily";

/**
 * Tells the server which time zone the learner is in, so the daily quiz turns
 * over at their midnight rather than the server's.
 *
 * Written on every page load rather than once, so it follows someone who
 * travels. The server only ever reads it; see requestTimeZone.
 */
const SCRIPT = `(function(){try{
var z=Intl.DateTimeFormat().resolvedOptions().timeZone;
if(z)document.cookie='${TZ_COOKIE}='+z+';path=/;max-age=31536000;samesite=lax';
}catch(e){}})()`;

export function TimeZoneScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
