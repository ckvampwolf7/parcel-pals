/**
 * Parcel Pals — shared domain contract.
 * Every module codes against these types. Changing them is a lead decision:
 * if you need a new field, add it as OPTIONAL and mention it in your report.
 */

export type Locale = 'ko' | 'en';

/** Text that carries both languages (simulated data provides both; real APIs fill both with the same raw string). */
export interface LocalizedText {
  ko: string;
  en: string;
}

/** The three courier pals. */
export type CharacterKind = 'truck' | 'plane' | 'bunny';

/** Visual/emotional state a character can show. Every character must support every mood. */
export type Mood =
  | 'idle' //       standing by, gentle breathing/bobbing
  | 'moving' //     travelling (wheels spin / propeller / hopping)
  | 'waiting' //    info received, not picked up yet; looking around, tapping foot
  | 'sleeping' //   nothing happening for a long time (overnight / stalled), zZz
  | 'worried' //    delay, failed attempt, exception; sweat drop, wobbly
  | 'happy' //      out for delivery / near; big smile, little bounce
  | 'celebrating'; // delivered; jump, arms/wings up, sparkles

/**
 * Normalized shipment status (maps onto AfterShip-style tags).
 * Order roughly follows the happy path.
 */
export type StatusTag =
  | 'pending' //               number registered, carrier has no data yet
  | 'info_received' //         label created / 접수
  | 'in_transit' //            moving between hubs (집화, 간선상차/하차 …)
  | 'customs' //               international: in customs clearance
  | 'out_for_delivery' //      배송출발
  | 'available_for_pickup' //  waiting at locker / store / post office
  | 'attempt_fail' //          delivery attempted, failed
  | 'delivered' //             배송완료
  | 'exception' //             lost, damaged, returned, held
  | 'expired'; //              no updates for too long

export type TransportMode = 'truck' | 'plane' | 'ship' | 'bike' | 'walk';

export type ShipmentScope = 'domestic' | 'international';

export interface Carrier {
  id: string; //                  e.g. 'kr.cjlogistics', 'us.ups'
  nameKo: string;
  nameEn: string;
  country: string; //             ISO-3166 alpha-2 of the carrier, or 'INTL'
  scope: ShipmentScope; //        what this carrier usually does
  trackingUrl?: string; //        public tracking page template with {number}
  color?: string; //              brand-ish accent used for small chips (optional)
}

export interface CarrierMatch {
  carrier: Carrier;
  /** 0..1 — detection is ambiguous for plain-digit Korean numbers, so return ranked candidates. */
  confidence: number;
}

export type StopKind = 'origin' | 'hub' | 'airport' | 'customs' | 'local' | 'destination';

/** A node on the journey path drawn by the Journey scene. */
export interface RouteStop {
  id: string;
  kind: StopKind;
  name: LocalizedText;
  /** How the parcel travels FROM this stop to the next one (ignored on the last stop). */
  modeToNext?: TransportMode;
}

export interface Checkpoint {
  id: string; //              stable across refreshes (used for unread/diffing)
  time: string; //            ISO-8601
  status: StatusTag;
  location: LocalizedText;
  message: LocalizedText; //  carrier-style message, e.g. 간선상차 / Departed facility
  /** Live data: the carrier's full description, e.g. "고객님의 상품을 배송할 예정입니다.(17~19시)". */
  detail?: string;
  /** Machine event code (e.g. 'pickup', 'hub_depart', 'customs_clear'); also embedded in `id` by the mock provider. */
  code?: string;
  /** index into snapshot.stops where this happened, if known */
  stopIndex?: number;
}

export interface Eta {
  earliest: string; // ISO
  latest: string; //   ISO
  /** 0..1 how sure we are */
  confidence?: number;
}

export interface TrackingSnapshot {
  status: StatusTag;
  /** Chronological, OLDEST FIRST. */
  checkpoints: Checkpoint[];
  stops: RouteStop[];
  /** 0..1 along the whole path of stops (0 = at origin, 1 = delivered). */
  progress: number;
  /** Index of the stop the parcel is at or last departed from. */
  currentStopIndex: number;
  /** Transport currently in use (what the character is "riding"). */
  currentMode: TransportMode;
  eta?: Eta;
  /** True when the plan slipped (drives 'worried' mood and copy). */
  delayed?: boolean;
  /** Short machine reason for the delay, e.g. 'weather' | 'hub_congestion' | 'customs_inspection' | 'holiday' (speech/i18n keys). */
  delayReason?: string;
  /** True when there has been no new checkpoint for unusually long for this stage (pal reassures + suggests next step). */
  stale?: boolean;
  /**
   * Cross-border handoff: the international carrier handed the parcel to a domestic carrier, which issued a NEW number.
   * Present once the handoff checkpoint has happened.
   */
  handoff?: { carrierId: string; trackingNumber: string; time: string };
  /** Where the data came from: the deterministic simulator (demo parcels) or a real carrier lookup. */
  source?: 'simulated' | 'live';
  /**
   * Live lookups only. 'not_found' = the carrier has no record yet (normal for a few hours after the label is made,
   * or the wrong carrier was picked); 'invalid' = the carrier rejected the number format (see liveMessage);
   * 'unsupported' = no real-time lookup exists for this carrier (show its website link instead).
   */
  liveStatus?: 'ok' | 'not_found' | 'invalid' | 'unsupported';
  /** Human-readable message from the carrier/API for liveStatus 'invalid' (usually Korean). */
  liveMessage?: string;
  /** For available_for_pickup: where to collect it. */
  pickup?: { place: LocalizedText; kind: 'convenience_store' | 'locker' | 'branch' | 'post_office' };
  /** ISO time the provider produced this snapshot (simulation time for the mock provider). */
  updatedAt: string;
}

export interface Parcel {
  id: string;
  trackingNumber: string;
  carrierId: string;
  nickname: string; //            user label, e.g. "Running shoes"
  character: CharacterKind;
  createdAt: string; //           ISO, SIMULATION time the user added it (sim clock; equals real time at 1× speed)
  archived: boolean;
  snapshot: TrackingSnapshot | null;
  /** Number of checkpoints the user hasn't seen yet. */
  unread: number;
  /** id of the newest checkpoint the user has seen on the detail screen */
  lastSeenCheckpointId?: string;
  /** last refresh error (i18n key or message) */
  error?: string;
  /** true while a refresh is in flight */
  refreshing?: boolean;
  /** Real time (ISO) of the last successful or failed live lookup — used to throttle polling. */
  lastCheckedAt?: string;
  /** Demo/sample parcel (created by loadDemo) */
  demo?: boolean;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  locale: Locale;
  /** 'auto' = pick by scope: domestic → truck, international → plane */
  defaultCharacter: CharacterKind | 'auto';
  /** In-app + browser notifications for new checkpoints */
  notifications: boolean;
  /** Simulation speed multiplier for the mock provider (1 = real time). */
  demoSpeed: number;
  /** Auto-refresh interval in real seconds. */
  refreshIntervalSec: number;
  theme: ThemePref;
  /** 'system' follows prefers-reduced-motion */
  reduceMotion: 'system' | 'on' | 'off';
  onboarded: boolean;
  /** Minutes between automatic live lookups for real parcels (manual refresh is always allowed). Default 10. */
  liveRefreshMin?: number;
  /**
   * Optional Delivery Tracker v2 API key "CLIENT_ID:CLIENT_SECRET" (tracker.delivery console).
   * When set, live lookups use the official v2 API first and fall back to the free v1 API.
   * Stored only on this device.
   */
  trackerApiKey?: string;
}

export interface InboxItem {
  id: string;
  parcelId: string;
  checkpointId: string;
  time: string; //    ISO (checkpoint time)
  status: StatusTag;
  /** What the parcel's character says about it */
  text: LocalizedText;
  read: boolean;
}

/** Events emitted by the store (toasts, browser notifications, sounds subscribe to these). */
export type AppEvent =
  | { type: 'parcel-added'; parcel: Parcel }
  | { type: 'parcel-updated'; parcel: Parcel; newCheckpoints: Checkpoint[] }
  | { type: 'parcel-delivered'; parcel: Parcel }
  | { type: 'parcel-removed'; parcelId: string }
  | { type: 'error'; message: string };

export interface AddParcelInput {
  trackingNumber: string;
  carrierId?: string; //   omitted → best detected candidate
  nickname?: string;
  character?: CharacterKind; // omitted → settings.defaultCharacter / auto
}
