/** Simulation clock: sim time advances at `speed`× real time; can jump forward (demo fast-forward). */

export interface SimClockState { anchorReal: number; anchorSim: number; speed: number }

export interface SimClock {
  /** current simulation time */
  now(): Date;
  /** change speed without jumping (re-anchors) */
  setSpeed(speed: number): void;
  /** jump forward by simulated hours */
  advance(hours: number): void;
  /** serializable state for persistence */
  toJSON(): SimClockState;
}

export function createSimClock(state?: SimClockState, realNow: () => number = () => Date.now()): SimClock {
  let anchorReal = state?.anchorReal ?? realNow();
  let anchorSim = state?.anchorSim ?? realNow();
  let speed = state?.speed ?? 1;
  if (!Number.isFinite(speed) || speed <= 0) speed = 1;
  const nowMs = () => anchorSim + (realNow() - anchorReal) * speed;
  return {
    now: () => new Date(nowMs()),
    setSpeed(s) {
      const n = nowMs();
      anchorReal = realNow();
      anchorSim = n;
      speed = Number.isFinite(s) && s > 0 ? s : 1;
    },
    advance(h) { if (Number.isFinite(h) && h > 0) anchorSim += h * 3.6e6; },
    toJSON: () => ({ anchorReal, anchorSim, speed }),
  };
}
