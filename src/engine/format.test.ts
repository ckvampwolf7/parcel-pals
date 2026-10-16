import { formatDateTime, formatEta, formatRelative, formatSnapshotEta, formatTime } from '@/engine';
import type { TrackingSnapshot } from '@/types';

// Fri 2026-10-16 10:00 in the *local* zone: tests are TZ-independent because inputs use local Date fields.
const now = new Date(2026, 9, 16, 10, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const eta = (a: string, b: string, confidence?: number) => ({ earliest: a, latest: b, confidence });

describe('formatEta', () => {
  it('unknown', () => {
    expect(formatEta(undefined, 'ko', now)).toBe('도착 예정일 확인 중');
    expect(formatEta(undefined, 'en', now)).toBe('Estimating arrival');
  });
  it('today (bucket) and today with a narrow window', () => {
    expect(formatEta(eta(at(16, 12), at(16, 20)), 'ko', now)).toBe('오늘 도착 예정');
    expect(formatEta(eta(at(16, 12), at(16, 20)), 'en', now)).toBe('Arriving today');
    expect(formatEta(eta(at(16, 14), at(16, 16)), 'ko', now)).toBe('오늘 오후 2–4시 도착 예정');
    expect(formatEta(eta(at(16, 14), at(16, 16)), 'en', now)).toBe('Arriving today, 2–4 PM');
    expect(formatEta(eta(at(16, 11), at(16, 13, 30)), 'ko', now)).toBe('오늘 오전 11시–오후 2시 도착 예정');
    expect(formatEta(eta(at(16, 11), at(16, 13, 30)), 'en', now)).toBe('Arriving today, 11 AM–2 PM');
  });
  it('tomorrow, today~tomorrow, tomorrow~day after', () => {
    expect(formatEta(eta(at(17, 9), at(17, 19)), 'ko', now)).toBe('내일 도착 예정');
    expect(formatEta(eta(at(17, 9), at(17, 19)), 'en', now)).toBe('Arriving tomorrow');
    expect(formatEta(eta(at(16, 15), at(17, 12)), 'ko', now)).toBe('오늘~내일 도착 예정');
    expect(formatEta(eta(at(17, 15), at(18, 12)), 'ko', now)).toBe('내일~모레 도착 예정');
    expect(formatEta(eta(at(17, 15), at(18, 12)), 'en', now)).toBe('Arriving in 1–2 days');
  });
  it('a single later day shows the date; wider ranges show day buckets', () => {
    expect(formatEta(eta(at(19, 9), at(19, 18)), 'ko', now)).toBe('10월 19일(월) 도착 예정');
    expect(formatEta(eta(at(19, 9), at(19, 18)), 'en', now)).toBe('Arriving Mon, Oct 19');
    expect(formatEta(eta(at(18, 9), at(20, 18)), 'ko', now)).toBe('2–4일 후 도착 예정');
    expect(formatEta(eta(at(18, 9), at(20, 18)), 'en', now)).toBe('Arriving in 2–4 days');
    expect(formatEta(eta(at(16, 12), at(19, 18)), 'ko', now)).toBe('3일 안에 도착 예정');
  });
  it('delivered ETA and overdue ETA', () => {
    expect(formatEta(eta(at(15, 14), at(15, 14), 1), 'ko', now)).toBe('10월 15일(목) 배송 완료');
    expect(formatEta(eta(at(15, 14), at(15, 14), 1), 'en', now)).toBe('Delivered Thu, Oct 15');
    expect(formatEta(eta(at(16, 9, 5), at(16, 9, 5), 1), 'ko', now)).toBe('오늘 오전 9:05 배송 완료');
    expect(formatEta(eta(at(15, 9), at(15, 12)), 'ko', now)).toBe('곧 도착 예정');
  });
});

describe('formatSnapshotEta', () => {
  const base: TrackingSnapshot = { status: 'pending', checkpoints: [], stops: [], progress: 0, currentStopIndex: 0, currentMode: 'truck', updatedAt: now.toISOString() };
  it('handles status-specific cases', () => {
    expect(formatSnapshotEta(null, 'ko', now)).toBe('택배사 정보 기다리는 중');
    expect(formatSnapshotEta({ ...base, status: 'available_for_pickup' }, 'en', now)).toBe('Ready for you to collect');
    expect(formatSnapshotEta({ ...base, status: 'in_transit', eta: eta(at(17, 9), at(17, 19)) }, 'ko', now)).toBe('내일 도착 예정');
  });
});

describe('date/time', () => {
  it('formatDateTime', () => {
    expect(formatDateTime(at(16, 14, 5), 'ko')).toBe('10월 16일(금) 오후 2:05');
    expect(formatDateTime(at(16, 14, 5), 'en')).toBe('Fri, Oct 16, 2:05 PM');
    expect(formatTime(at(16, 0, 7), 'ko')).toBe('오전 12:07');
    expect(formatTime(at(16, 12, 30), 'en')).toBe('12:30 PM');
  });
  it('formatRelative', () => {
    const iso = (min: number) => new Date(now.getTime() - min * 6e4).toISOString();
    expect(formatRelative(iso(0), 'ko', now)).toBe('방금 전');
    expect(formatRelative(iso(5), 'ko', now)).toBe('5분 전');
    expect(formatRelative(iso(5), 'en', now)).toBe('5 min ago');
    expect(formatRelative(iso(180), 'ko', now)).toBe('3시간 전');
    expect(formatRelative(iso(60 * 48), 'en', now)).toBe('2 d ago');
    expect(formatRelative(iso(-120), 'ko', now)).toBe('2시간 후');
    expect(formatRelative(at(1, 12), 'ko', now)).toBe('10월 1일(목)');
  });
});
