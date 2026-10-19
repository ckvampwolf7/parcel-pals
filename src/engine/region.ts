/**
 * The user's home region (Korea or the US). Decides which carriers count as domestic, which holiday calendar
 * applies to real parcels, and how ambiguous numbers are ranked. The store sets it from settings
 * (like setLiveApiKey); engine functions read it as their default.
 */
import type { Region } from '@/types';

let current: Region = 'KR';

export function setUserRegion(region: Region): void { current = region; }
export function getUserRegion(): Region { return current; }

const US_ZONE = /^(America\/|US\/|Pacific\/Honolulu$)/;

/**
 * Region from the device: the time zone wins (America/* and Hawaii → US, Asia/Seoul → KR),
 * then the language (en-US → US). Anything else → KR.
 */
export function detectRegion(env: { timeZone?: string; languages?: readonly string[] } = readEnv()): Region {
  const tz = env.timeZone ?? '';
  if (tz === 'Asia/Seoul') return 'KR';
  if (US_ZONE.test(tz)) return 'US';
  if (env.languages?.[0]?.toLowerCase() === 'en-us') return 'US';
  return 'KR';
}

let envOverride: Region | undefined;
/** TEST-ONLY: pin what detectRegion() reads from the device (undefined = real device). */
export function __setDetectedRegionForTests(region: Region | undefined): void { envOverride = region; }

function readEnv(): { timeZone?: string; languages?: readonly string[] } {
  if (envOverride) return { timeZone: envOverride === 'US' ? 'America/New_York' : 'Asia/Seoul' };
  let timeZone: string | undefined;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* very old browser */ }
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const languages = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
  return { timeZone, languages };
}
