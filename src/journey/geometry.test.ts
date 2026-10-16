import { buildLut, layoutScene, lengthAtK, pointAtLength, stopAxisPosition } from './geometry';
import { DOMESTIC_STOPS, INTL_STOPS } from './fixtures';
import { groupByDay, prettyNumber } from './format';
import type { Checkpoint } from '@/types';

describe('journey geometry', () => {
  it('fits a domestic route into a 360px phone without scrolling', () => {
    const l = layoutScene(DOMESTIC_STOPS, 328);
    expect(l.scrolls).toBe(false);
    expect(l.width).toBe(328);
    expect(l.points).toHaveLength(5);
  });

  it('lets a long international route scroll horizontally', () => {
    const l = layoutScene(INTL_STOPS, 328);
    expect(l.scrolls).toBe(true);
    expect(l.width).toBeGreaterThan(328);
    // the flight leg arcs up into the sky
    const air = l.segments.find((s) => s.mode === 'plane')!;
    expect(Math.min(air.p[1].y, air.p[2].y)).toBeLessThan(air.p[0].y - 40);
  });

  it('point lookups land on the stops', () => {
    const l = layoutScene(INTL_STOPS, 400);
    const lut = buildLut(l.segments);
    for (let i = 0; i < l.points.length; i++) {
      const p = pointAtLength(l, lut, lengthAtK(i, lut.lengths));
      expect(p.x).toBeCloseTo(l.points[i].x, 0);
      expect(p.y).toBeCloseTo(l.points[i].y, 0);
    }
  });

  it('keeps the pal consistent with currentStopIndex', () => {
    expect(stopAxisPosition(0.5, 2, 5)).toBe(2);
    expect(stopAxisPosition(0.1, 2, 5)).toBe(2);
    expect(stopAxisPosition(0.9, 2, 5)).toBe(3);
    expect(stopAxisPosition(1, 4, 5)).toBe(4);
  });

  it('formats helpers', () => {
    expect(prettyNumber('612345678901')).toBe('6123 4567 8901');
    expect(prettyNumber('1Z999AA10123456784')).toBe('1Z999AA10123456784');
    const c = (id: string, time: string) => ({ id, time }) as Checkpoint;
    const g = groupByDay([c('a', '2026-10-14T01:00:00'), c('b', '2026-10-14T05:00:00'), c('c', '2026-10-15T05:00:00')]);
    expect(g.map((x) => x.items.map((i) => i.id))).toEqual([['c'], ['b', 'a']]);
  });
});
