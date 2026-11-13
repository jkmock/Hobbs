export function minutesToTenths(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`Invalid minutes: ${minutes}`);
  }
  return Math.round(minutes / 6) / 10;
}

export * from "./schemas/aircraft.js";
export * from "./schemas/common.js";
export * from "./schemas/instructors.js";
export * from "./schemas/flights.js";
export * from "./schemas/auth.js";
export * from "./schemas/social.js";