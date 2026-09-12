import "server-only";
import { cookies } from "next/headers";

/** Questions in one day's quiz. */
export const DAILY_QUIZ_SIZE = 5;

/**
 * Cookie carrying the browser's IANA time zone, written by TimeZoneScript.
 *
 * "Each day" has to mean the learner's day. Most hosts run on UTC, which would
 * roll the quiz over at seven in the morning in Jakarta and five in the
 * afternoon in Los Angeles.
 */
export const TZ_COOKIE = "kanjikan-tz";

function isTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The time zone of the browser making this request, or UTC.
 *
 * UTC covers the one request made before the cookie exists — in practice the
 * first page ever loaded, which is never the quiz. A forged value can move the
 * learner's day by at most a few hours, which gains them nothing.
 */
export function requestTimeZone(): string {
  const zone = cookies().get(TZ_COOKIE)?.value;
  return zone && isTimeZone(zone) ? zone : "UTC";
}

/** The calendar date, as YYYY-MM-DD, at a moment in a time zone. */
export function localDate(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** A YYYY-MM-DD date moved by whole days. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The shuffle seed for one learner's quiz on one day.
 *
 * Fixed by who and when, so a reload shows the same questions and the answer
 * route can rebuild them to check an answer. FNV-1a, as for word ids.
 */
export function dailySeed(userId: string, date: string): number {
  const key = `${userId}|${date}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}
