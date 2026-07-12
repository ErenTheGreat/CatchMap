/** Astronomical helpers ported from SunCalc (MIT) — sun/moon times without external deps. */

const PI = Math.PI;
const DEG = PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = DEG * 23.4397;

function toJulian(date: Date): number {
  return date.valueOf() / DAY_MS - 0.5 + J1970;
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(
    Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
    Math.cos(l)
  );
}

function declination(l: number, b: number): number {
  return Math.asin(
    Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)
  );
}

function siderealTime(d: number, lw: number): number {
  return DEG * (280.16 + 360.9856235 * d) - lw;
}

function solarMeanAnomaly(d: number): number {
  return DEG * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(M: number): number {
  const C =
    DEG * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = DEG * 102.9372;
  return M + C + P + PI;
}

function sunCoords(d: number) {
  const M = solarMeanAnomaly(d);
  const L = eclipticLongitude(M);
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d: number) {
  const L = DEG * (218.316 + 13.176396 * d);
  const M = DEG * (134.963 + 13.064993 * d);
  const F = DEG * (93.272 + 13.22935 * d);
  const l = L + DEG * 6.289 * Math.sin(M);
  const b = DEG * 5.128 * Math.sin(F);
  const dist = 385_001 - 20_905 * Math.cos(M);
  return { ra: rightAscension(l, b), dec: declination(l, b), dist };
}

function altitude(H: number, phi: number, dec: number): number {
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
}

function astroRefraction(h: number): number {
  const alt = h < 0 ? 0 : h;
  return 0.0002967 / Math.tan(alt + 0.00312536 / (alt + 0.08901179));
}

function getMoonPosition(date: Date, lat: number, lng: number) {
  const lw = DEG * -lng;
  const phi = DEG * lat;
  const d = toDays(date);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  let h = altitude(H, phi, c.dec);
  h += astroRefraction(h);
  return { altitude: h };
}

function getMoonIllumination(date: Date) {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149_598_000;
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) +
      Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
  );
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
  );
  const phase = 0.5 + (0.5 * inc * (angle < 0 ? -1 : 1)) / Math.PI;
  return { phase: ((phase % 1) + 1) % 1 };
}

function hoursLater(date: Date, h: number): Date {
  return new Date(date.valueOf() + (h * DAY_MS) / 24);
}

function getMoonTimes(date: Date, lat: number, lng: number): { rise?: Date; set?: Date } {
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);

  const hc = 0.133 * DEG;
  let h0 = getMoonPosition(t, lat, lng).altitude - hc;
  let rise: number | undefined;
  let set: number | undefined;

  for (let i = 1; i <= 24; i += 2) {
    const h1 = getMoonPosition(hoursLater(t, i), lat, lng).altitude - hc;
    const h2 = getMoonPosition(hoursLater(t, i + 1), lat, lng).altitude - hc;

    const a = (h0 + h2) / 2 - h1;
    const b = (h2 - h0) / 2;
    const xe = -b / (2 * a);
    const ye = (a * xe + b) * xe + h1;
    const d = b * b - 4 * a * h1;
    let roots = 0;
    let x1 = xe;
    let x2 = xe;

    if (d >= 0) {
      const dx = Math.sqrt(d) / (Math.abs(a) * 2);
      x1 = xe - dx;
      x2 = xe + dx;
      if (Math.abs(x1) <= 1) roots++;
      if (Math.abs(x2) <= 1) roots++;
      if (x1 < -1) x1 = x2;
    }

    if (roots === 1) {
      if (h0 < 0) rise = i + x1;
      else set = i + x1;
    } else if (roots === 2) {
      rise = i + (ye < 0 ? x2 : x1);
      set = i + (ye < 0 ? x1 : x2);
    }

    if (rise != null && set != null) break;
    h0 = h2;
  }

  const result: { rise?: Date; set?: Date } = {};
  if (rise != null) result.rise = hoursLater(t, rise);
  if (set != null) result.set = hoursLater(t, set);
  return result;
}

function julianCycle(d: number, lw: number): number {
  return Math.round(d - 0.0009 - lw / (2 * PI));
}

function approxTransit(Ht: number, lw: number, n: number): number {
  return 0.0009 + (Ht + lw) / (2 * PI) + n;
}

function hourAngle(h: number, phi: number, dec: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
}

function solarTransitJ(ds: number, M: number, L: number): number {
  return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
}

function getSetJ(
  h: number,
  lw: number,
  phi: number,
  dec: number,
  n: number,
  M: number,
  L: number
): number {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, M, L);
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * DAY_MS);
}

/** Civil twilight (~6° below horizon). */
export function computeCivilTwilight(
  date: Date,
  latitude: number,
  longitude: number
): { begin: Date; end: Date } {
  const lw = DEG * -longitude;
  const phi = DEG * latitude;
  const h = DEG * -6;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L, 0);
  const Jnoon = solarTransitJ(ds, M, L);
  const Jset = getSetJ(h, lw, phi, dec, n, M, L);
  const Jrise = Jnoon - (Jset - Jnoon);
  return { begin: fromJulian(Jrise), end: fromJulian(Jset) };
}

export function moonPhaseLabel(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return 'New Moon';
  if (p < 0.22) return 'Waxing Crescent';
  if (p < 0.28) return 'First Quarter';
  if (p < 0.47) return 'Waxing Gibbous';
  if (p < 0.53) return 'Full Moon';
  if (p < 0.72) return 'Waning Gibbous';
  if (p < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

export function computeMoonData(
  date: Date,
  latitude: number,
  longitude: number
): {
  moonPhase: number;
  moonrise?: string;
  moonset?: string;
  moonPhaseLabel: string;
} {
  const illumination = getMoonIllumination(date);
  const times = getMoonTimes(date, latitude, longitude);
  return {
    moonPhase: illumination.phase,
    moonrise: times.rise?.toISOString(),
    moonset: times.set?.toISOString(),
    moonPhaseLabel: moonPhaseLabel(illumination.phase),
  };
}
