export function getRandomIntInclusive(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
}

/** HomeKit CurrentRelativeHumidity must be a finite number in 0–100; Flair often omits humidity. */
export function normalizeRelativeHumidity(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(100, Math.max(0, value));
}
