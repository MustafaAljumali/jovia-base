export interface Clock {
  now(): Date;
}

export class FakeClock implements Clock {
  constructor(private current: Date = new Date("2026-08-04T00:00:00.000Z")) {}

  now() {
    return new Date(this.current);
  }

  advance(milliseconds: number) {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error("invalid advance");
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export function sequenceId(prefix = "test") {
  let value = 0;
  return () => `${prefix}-${++value}`;
}
