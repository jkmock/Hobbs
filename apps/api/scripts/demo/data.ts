// The demo account and its world: a student pilot in North Carolina near the end of private
// pilot training, twelve friends, their flights, checkrides, props and comments. Used for App Review and the
// App Store screenshots; loaded by seed.ts. Everything here is made up.
//
// Dates are days before the day the seed runs, so the data always looks current (and the
// 2-month checkride-prep window on the Goal tab counts the recent lessons). Times are local
// to the pilot's home airport.
//
// The demo pilot's logbook is planned against the Goal tab (14 CFR 61.109(a)):
//   total 35.5 / 40 · dual 25.9 / 20 · dual XC 4.4 / 3 · dual night 1.3 / 3
//   dual instrument 3.6 / 3 · checkride prep 7.3 / 3 · night full stops 6 / 10
//   night XC over 100 nm 0 / 1 · solo 9.6 / 10 · solo XC 5.0 / 5 · long solo XC 1 / 1
// So a few bars are still to go (total, solo, and the night requirements), as for a real
// student a few weeks out from the checkride.

import type { LatLon, Maneuver } from "./tracks.js";

// Landing direction (degrees true) of the runway each airport's tracks use. Left traffic.
export const RUNWAYS: Record<string, number> = {
  KTTA: 210, KILM: 240, KINT: 330, KOAJ: 50, KRWI: 220, KFAY: 220, KRDU: 230, KSOP: 230,
  KHRJ: 50, KJNX: 210, KBUY: 60, KMRH: 260, KSUT: 230, KJQF: 20, KGSO: 230, KHKY: 240,
  KAVL: 350, KFFA: 20, KEWN: 40, KMYR: 180, KCHS: 150, KHSE: 70,
  KSEE: 270, KCRQ: 240, KAPA: 350, KBJC: 300, KASE: 150, KEGE: 250,
};

// Practice areas, where maneuvers are flown.
export const PRACTICE: Record<string, LatLon> = {
  ttaWest: { lat: 35.64, lon: -79.38 }, // over Chatham County, toward Siler City, west of Sanford
  jnxEast: { lat: 35.47, lon: -78.18 }, // farmland east of Johnston County
  seeEast: { lat: 32.86, lon: -116.75 }, // east of Gillespie Field
  apaSoutheast: { lat: 39.47, lon: -104.66 }, // southeast of Centennial
};

export type DemoAircraft = {
  tail: string;
  make: string;
  model: string;
  year?: number;
  tailwheel?: boolean;
  complex?: boolean;
  highPerf?: boolean;
};

export const AIRCRAFT: DemoAircraft[] = [
  // The Sanford flight school's fleet: real, active aircraft, so the app's FlightAware lookup
  // (Log Flight → Route) finds their actual recent flights. Year left out: not known here.
  { tail: "N8092E", make: "Piper", model: "PA-28-181 Archer" },
  { tail: "N36395", make: "Piper", model: "PA-28-161 Warrior" },
  { tail: "N199GW", make: "Piper", model: "PA-28-181 Archer" },
  { tail: "N4417R", make: "Cessna", model: "172R Skyhawk", year: 1999 },
  { tail: "N2856Q", make: "Piper", model: "PA-28-181 Archer III", year: 2002 },
  { tail: "N9713H", make: "Cessna", model: "172S Skyhawk", year: 2007 },
  { tail: "N820SR", make: "Cirrus", model: "SR20", year: 2010 },
  { tail: "N3517G", make: "Cessna", model: "172N Skyhawk", year: 1978 },
  { tail: "N48911", make: "Cessna", model: "152", year: 1979 },
  { tail: "N745DS", make: "Diamond", model: "DA40 Diamond Star", year: 2008 },
  { tail: "N5309B", make: "Cessna", model: "172P Skyhawk", year: 1982 },
];

export type DemoLeg = { from: string; to: string; stops?: [airport: string, touchAndGoes: number][] };

export type DemoFlight = {
  key: string; // for props and comments below
  daysAgo: number;
  at: string; // departure, local "HH:MM"
  aircraft: string;
  legs: DemoLeg[];
  practice?: { area: keyof typeof PRACTICE; maneuvers: Maneuver[] }; // flown on the last leg
  extraCircuits?: number; // full-stop taxi-backs and laps of the destination's pattern
  total: number;
  dual?: number;
  solo?: number;
  pic?: number; // defaults to the solo time
  xc?: number;
  night?: number;
  sim?: number; // simulated instrument (the hood)
  actual?: number; // actual instrument (in cloud)
  dayFs?: number;
  dayTg?: number;
  nightFs?: number;
  nightTg?: number;
  approaches?: number;
  instructor?: string;
  notes?: string;
};

export type DemoPerson = {
  key: string;
  firstName: string;
  lastName: string;
  goal: "private" | "instrument" | "commercial";
  aircraft: string[];
  flights: DemoFlight[];
  checkrides?: { key: string; goal: "private" | "instrument"; daysAgo: number }[];
};

const MIKE = "Mike Donnelly";

// The account App Review signs in to. Its email and password come from the seed's environment.
export const DEMO_PILOT: DemoPerson = {
  key: "ethan",
  firstName: "Ethan",
  lastName: "Carter",
  goal: "private",
  aircraft: ["N36395", "N8092E", "N199GW"],
  flights: [
    { key: "f1", daysAgo: 150, at: "09:30", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["stalls"] },
      total: 1.0, dual: 1.0, dayFs: 1, instructor: MIKE,
      notes: "Discovery flight turned first lesson. Straight-and-level, climbs, descents and a few gentle turns over the Haw River. Couldn't stop smiling." },
    { key: "f2", daysAgo: 145, at: "10:00", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep"] },
      total: 1.2, dual: 1.2, dayFs: 1, instructor: MIKE,
      notes: "Steep turns and slow flight. Finally holding altitude within 100 ft on the 45° turns." },
    { key: "f3", daysAgo: 140, at: "15:30", aircraft: "N199GW", legs: [{ from: "KJNX", to: "KJNX" }], practice: { area: "jnxEast", maneuvers: ["stalls", "steep"] },
      total: 1.1, dual: 1.1, sim: 0.3, dayFs: 1, instructor: MIKE,
      notes: "Lesson out of the school's Smithfield location (the only open Archer this week). Power-on and power-off stalls, and 0.3 under the hood on the way back." },
    { key: "f4", daysAgo: 133, at: "08:45", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 5,
      total: 1.0, dual: 1.0, dayFs: 1, dayTg: 5, instructor: MIKE,
      notes: "Pattern work on 21. Six landings, two of them actually good. The flare is starting to click." },
    { key: "f5", daysAgo: 128, at: "13:15", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA", stops: [["KSOP", 3]] }], practice: { area: "ttaWest", maneuvers: ["sturns", "circle"] },
      total: 1.3, dual: 1.3, sim: 0.3, dayFs: 1, dayTg: 3, instructor: MIKE,
      notes: "Ground reference: S-turns along US-421 and turns around a silo near Siler City, then three touch-and-goes at Pinehurst." },
    { key: "f6", daysAgo: 121, at: "10:30", aircraft: "N36395", legs: [{ from: "KTTA", to: "KHRJ" }, { from: "KHRJ", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["stalls"] },
      total: 1.2, dual: 1.2, dayFs: 2, instructor: MIKE,
      notes: "Emergencies day. Over to Harnett Regional to talk through engine-out procedures on the ramp, then a simulated engine failure over Chatham County on the way home. Picked a pasture." },
    { key: "f7", daysAgo: 115, at: "16:00", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 6,
      total: 1.0, dual: 1.0, dayFs: 1, dayTg: 6, instructor: MIKE,
      notes: "More pattern. Wind 270 at 12 gusting 18 kept the crosswind landings on 21 interesting." },
    { key: "f8", daysAgo: 110, at: "09:00", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 4,
      total: 1.1, dual: 0.6, solo: 0.5, dayFs: 4, dayTg: 2, instructor: MIKE,
      notes: "FIRST SOLO! 🎉 Mike hopped out after three landings and I took it around three more times by myself. That empty right seat is loud." },
    { key: "f9", daysAgo: 104, at: "11:15", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 4,
      total: 0.8, solo: 0.8, dayFs: 1, dayTg: 4,
      notes: "Solo pattern session. Working on holding 65 knots all the way down final." },
    { key: "f10", daysAgo: 100, at: "14:00", aircraft: "N199GW", legs: [{ from: "KTTA", to: "KJNX" }, { from: "KJNX", to: "KBUY" }, { from: "KBUY", to: "KTTA" }],
      total: 1.4, dual: 1.4, dayFs: 3, instructor: MIKE,
      notes: "Short- and soft-field day: a full stop at Johnston County, another at Burlington-Alamance, and home." },
    { key: "f11", daysAgo: 95, at: "10:45", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "stalls"] },
      total: 1.0, solo: 1.0, dayFs: 1,
      notes: "First solo trip to the practice area. Steep turns, slow flight, and a lot of looking outside." },
    { key: "f12", daysAgo: 90, at: "15:00", aircraft: "N36395", legs: [{ from: "KTTA", to: "KJNX" }], practice: { area: "jnxEast", maneuvers: ["stalls", "circle"] },
      total: 1.6, dual: 1.6, sim: 0.8, dayFs: 1, instructor: MIKE,
      notes: "VOR tracking and 0.8 under the hood, then dropped the Warrior off at Johnston County for its annual. Unusual attitude recoveries are a lot less fun with foggles on." },
    { key: "f13", daysAgo: 85, at: "09:15", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KILM" }, { from: "KILM", to: "KSUT" }, { from: "KSUT", to: "KTTA" }],
      total: 2.4, dual: 2.4, xc: 2.4, dayFs: 3, instructor: MIKE,
      notes: "First cross-country! Pilotage down to Wilmington, a short hop to Oak Island along the beach, and back up the Cape Fear River." },
    { key: "f14", daysAgo: 80, at: "20:15", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 3,
      total: 1.3, dual: 1.3, night: 1.3, nightFs: 6, instructor: MIKE,
      notes: "First night lesson: six full-stop landings on 21. The flare picture is completely different with only the runway lights." },
    { key: "f15", daysAgo: 75, at: "10:00", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KINT" }, { from: "KINT", to: "KTTA" }],
      total: 2.0, dual: 2.0, xc: 2.0, dayFs: 2, instructor: MIKE,
      notes: "Dual cross-country to Winston-Salem: approach, tower and ground all on one trip. Smith Reynolds tower was great." },
    { key: "f16", daysAgo: 70, at: "13:30", aircraft: "N199GW", legs: [{ from: "KTTA", to: "KHRJ" }, { from: "KHRJ", to: "KTTA" }],
      total: 1.1, solo: 1.1, dayFs: 2,
      notes: "First solo landing somewhere new: Harnett Regional. A King Air joined the pattern and kept me on my toes." },
    { key: "f17", daysAgo: 63, at: "10:00", aircraft: "N36395", legs: [{ from: "KJNX", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["stalls"] },
      total: 1.5, dual: 1.5, sim: 0.7, dayFs: 1, instructor: MIKE,
      notes: "Picked the Warrior up from its annual at Johnston County. On the way home Mike pointed at the sectional and said “take me to Siler City”: diversion practice, then 0.7 under the hood." },
    { key: "f18", daysAgo: 58, at: "12:30", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KBUY" }, { from: "KBUY", to: "KTTA" }],
      total: 1.4, dual: 1.4, sim: 0.5, dayFs: 2, approaches: 1, instructor: MIKE,
      notes: "Simulated RNAV 24 approach into Burlington-Alamance under the hood, a full stop, and back home." },
    { key: "f19", daysAgo: 55, at: "09:45", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KOAJ" }, { from: "KOAJ", to: "KFAY" }],
      total: 1.8, solo: 1.8, xc: 1.8, dayFs: 2,
      notes: "Solo cross-country to Jacksonville around the Camp Lejeune restricted areas. Storms built over Sanford on the way back, so I diverted to Fayetteville and the school drove down to get me." },
    { key: "f19b", daysAgo: 54, at: "08:15", aircraft: "N8092E", legs: [{ from: "KFAY", to: "KTTA" }],
      total: 0.4, solo: 0.4, dayFs: 1,
      notes: "Flew the Archer home from Fayetteville the morning after the diversion. Smooth air and clear skies." },
    { key: "f20", daysAgo: 48, at: "14:45", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KSOP" }, { from: "KSOP", to: "KHRJ" }, { from: "KHRJ", to: "KTTA" }],
      total: 1.2, dual: 1.2, dayFs: 3, instructor: MIKE,
      notes: "Airport hopping: Pinehurst, then Harnett, then home. Golf courses everywhere around Moore County." },
    { key: "f21", daysAgo: 40, at: "08:30", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KRWI" }, { from: "KRWI", to: "KFAY" }, { from: "KFAY", to: "KTTA" }],
      total: 3.2, solo: 3.2, xc: 3.2, dayFs: 3,
      notes: "The long solo cross-country: Sanford → Rocky Mount → Fayetteville → home, 169 nm. Fayetteville Approach routed me around Fort Bragg's restricted areas. Best day in the airplane so far." },
    { key: "f22", daysAgo: 36, at: "11:00", aircraft: "N199GW", legs: [{ from: "KTTA", to: "KRDU" }, { from: "KRDU", to: "KTTA" }],
      total: 1.5, dual: 1.5, sim: 0.4, dayFs: 2, instructor: MIKE,
      notes: "Class C practice: landed at Raleigh-Durham between two airliners and taxied past the terminal. Tower was super patient." },
    { key: "f23", daysAgo: 27, at: "15:15", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "stalls"] },
      total: 1.3, dual: 1.3, sim: 0.6, dayFs: 1, instructor: MIKE,
      notes: "Checkride-style lesson: simulated engine failure, steep turns, slow flight, and 0.6 under the hood." },
    { key: "f24", daysAgo: 20, at: "10:30", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KJNX" }, { from: "KJNX", to: "KTTA" }],
      total: 0.8, solo: 0.8, dayFs: 2,
      notes: "Quick solo hop to Johnston County and back to sharpen the landings before my stage check." },
    { key: "f25", daysAgo: 14, at: "09:00", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "sturns", "stalls"] },
      total: 1.0, dual: 1.0, dayFs: 1, instructor: "Karen Walsh",
      notes: "Stage check with the chief instructor. Passed! Checkride next." },
    { key: "f26", daysAgo: 6, at: "13:00", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KHRJ" }], practice: { area: "ttaWest", maneuvers: ["circle"] }, extraCircuits: 3,
      total: 0.9, dual: 0.9, dayFs: 1, dayTg: 3, instructor: MIKE,
      notes: "Power-off 180s and short-field landings at Harnett." },
  ],
};

// Friends of the demo pilot (and of each other). Mostly from the same flight school at Sanford,
// a few from other North Carolina fields, and two from further away.
export const FRIENDS: DemoPerson[] = [
  { key: "ryan", firstName: "Ryan", lastName: "Mitchell", goal: "instrument", aircraft: ["N8092E"],
    checkrides: [{ key: "checkride", goal: "private", daysAgo: 3 }],
    flights: [
      { key: "r1", daysAgo: 19, at: "10:00", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KMRH" }, { from: "KMRH", to: "KTTA" }],
        total: 2.6, solo: 2.6, xc: 2.6, dayFs: 2,
        notes: "Solo cross-country to Beaufort on the Crystal Coast. Lunch within walking distance of the ramp, and the Outer Banks on the horizon." },
      { key: "r2", daysAgo: 9, at: "14:30", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "stalls"] },
        total: 1.2, dual: 1.2, dayFs: 1, instructor: MIKE, notes: "Mock checkride. Steep turns and slow flight are dialed in." },
      { key: "r3", daysAgo: 3, at: "09:00", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KTTA", stops: [["KSOP", 1]] }], practice: { area: "ttaWest", maneuvers: ["steep", "circle"] },
        total: 1.7, pic: 1.7, dayFs: 1, dayTg: 1,
        notes: "Checkride day. Diversion toward Pinehurst, steep turns, short-field, power-off 180. PASSED ✈️" },
    ] },
  { key: "tyler", firstName: "Tyler", lastName: "Brooks", goal: "instrument", aircraft: ["N199GW"],
    checkrides: [{ key: "checkride", goal: "private", daysAgo: 30 }],
    flights: [
      { key: "t1", daysAgo: 30, at: "08:30", aircraft: "N199GW", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "sturns"] },
        total: 1.5, pic: 1.5, dayFs: 1, notes: "Checkride flight. The nerves were gone after the first steep turn." },
      { key: "t2", daysAgo: 26, at: "11:00", aircraft: "N199GW", legs: [{ from: "KTTA", to: "KSUT" }, { from: "KSUT", to: "KTTA" }],
        total: 2.1, pic: 2.1, xc: 2.1, dayFs: 2, notes: "First flight with a passenger: took my dad to Oak Island for lunch. The beach is a bike ride from the ramp." },
      { key: "t3", daysAgo: 11, at: "16:00", aircraft: "N199GW", legs: [{ from: "KTTA", to: "KTTA", stops: [["KBUY", 1], ["KSOP", 1]] }],
        total: 1.5, dual: 1.5, sim: 1.2, dayFs: 1, dayTg: 2, approaches: 2, instructor: MIKE,
        notes: "Instrument training begins. Two approaches under the hood: RNAV 24 at Burlington and RNAV 23 at Pinehurst." },
    ] },
  { key: "marcus", firstName: "Marcus", lastName: "Bennett", goal: "commercial", aircraft: ["N4417R"],
    checkrides: [{ key: "checkride", goal: "instrument", daysAgo: 18 }],
    flights: [
      { key: "m1", daysAgo: 22, at: "07:30", aircraft: "N4417R", legs: [{ from: "KJQF", to: "KGSO" }, { from: "KGSO", to: "KJQF" }],
        total: 2.3, dual: 2.3, xc: 2.3, actual: 1.1, sim: 0.6, dayFs: 2, approaches: 3, instructor: "Luis Ortega",
        notes: "IFR cross-country: Concord to Greensboro and back. Real IMC the whole way and the ILS 23R into GSO down to minimums." },
      { key: "m2", daysAgo: 18, at: "13:00", aircraft: "N4417R", legs: [{ from: "KJQF", to: "KJQF", stops: [["KHKY", 1]] }],
        total: 1.4, pic: 1.4, sim: 1.1, dayFs: 1, dayTg: 1, approaches: 3,
        notes: "Instrument checkride: ILS 24 at Hickory, then an RNAV and a partial-panel approach back at Concord. Instrument rated!" },
      { key: "m3", daysAgo: 5, at: "10:15", aircraft: "N4417R", legs: [{ from: "KJQF", to: "KAVL" }, { from: "KAVL", to: "KJQF" }],
        total: 2.2, pic: 2.2, xc: 2.2, dayFs: 2, notes: "Asheville for brunch 🥞 The Blue Ridge in full fall color from 7,500 ft." },
      { key: "m4", daysAgo: 1, at: "16:15", aircraft: "N4417R", legs: [{ from: "KJQF", to: "KMYR" }, { from: "KMYR", to: "KCHS" }],
        total: 2.5, pic: 2.5, xc: 2.5, dayFs: 2,
        notes: "Weekend in Charleston. Stopped in Myrtle Beach for fuel and a walk on the beach, then on down the coast." },
    ] },
  { key: "jake", firstName: "Jake", lastName: "Sullivan", goal: "private", aircraft: ["N36395"],
    flights: [
      { key: "j1", daysAgo: 21, at: "09:00", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["stalls"] },
        total: 1.0, dual: 1.0, dayFs: 1, instructor: MIKE,
        notes: "First lesson! Took off, flew out over Jordan Lake, and landed (with a lot of help)." },
      { key: "j2", daysAgo: 13, at: "15:00", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep"] },
        total: 1.2, dual: 1.2, dayFs: 1, instructor: MIKE, notes: "Steep turns. My instructor says to stop staring at the altimeter." },
      { key: "j3", daysAgo: 2, at: "11:30", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 5,
        total: 1.0, dual: 1.0, dayFs: 1, dayTg: 5, instructor: MIKE, notes: "Pattern work. Five touch-and-goes, and no bounces on the last two." },
    ] },
  { key: "daniel", firstName: "Daniel", lastName: "Park", goal: "private", aircraft: ["N2856Q"],
    flights: [
      { key: "d1", daysAgo: 19, at: "10:30", aircraft: "N2856Q", legs: [{ from: "KILM", to: "KMRH" }, { from: "KMRH", to: "KILM" }],
        total: 2.0, solo: 2.0, xc: 2.0, dayFs: 2,
        notes: "Solo cross-country up the coast to Beaufort, past Camp Lejeune and the Bogue Banks." },
      { key: "d2", daysAgo: 7, at: "19:30", aircraft: "N2856Q", legs: [{ from: "KILM", to: "KILM" }], extraCircuits: 4,
        total: 1.3, dual: 1.3, night: 1.3, nightFs: 1, nightTg: 4, instructor: "Grace Kim",
        notes: "Night pattern work at Wilmington with Wrightsville Beach lit up to the east." },
    ] },
  { key: "chris", firstName: "Chris", lastName: "Romero", goal: "private", aircraft: ["N9713H"],
    flights: [
      { key: "c1", daysAgo: 15, at: "09:45", aircraft: "N9713H", legs: [{ from: "KSEE", to: "KCRQ" }, { from: "KCRQ", to: "KSEE" }],
        total: 1.6, dual: 1.6, dayFs: 2, instructor: "Tom Alvarez",
        notes: "Out to Palomar along the coast under the San Diego Class B. Ocean views the whole way." },
      { key: "c2", daysAgo: 4, at: "08:15", aircraft: "N9713H", legs: [{ from: "KSEE", to: "KSEE" }], practice: { area: "seeEast", maneuvers: ["steep", "stalls"] },
        total: 1.2, solo: 1.2, dayFs: 1, notes: "Morning solo in the practice area east of Gillespie before the marine layer burned off." },
    ] },
  { key: "nate", firstName: "Nate", lastName: "Fischer", goal: "commercial", aircraft: ["N820SR"],
    flights: [
      { key: "n1", daysAgo: 10, at: "09:30", aircraft: "N820SR", legs: [{ from: "KTTA", to: "KFFA" }, { from: "KFFA", to: "KHSE" }, { from: "KHSE", to: "KTTA" }],
        total: 3.8, pic: 3.8, xc: 3.8, dayFs: 3,
        notes: "Outer Banks day: First Flight Airport by the Wright Brothers memorial, then down to Hatteras for lunch and the lighthouse. Building time toward the commercial, one landmark at a time." },
      { key: "n2", daysAgo: 2, at: "15:30", aircraft: "N820SR", legs: [{ from: "KTTA", to: "KAVL" }],
        total: 1.4, pic: 1.4, xc: 1.4, dayFs: 1, notes: "Flew my sister out to Asheville for the week. Mountain wave on the way in kept it interesting." },
    ] },
  { key: "owen", firstName: "Owen", lastName: "Gallagher", goal: "private", aircraft: ["N3517G"],
    flights: [
      { key: "o1", daysAgo: 17, at: "13:45", aircraft: "N3517G", legs: [{ from: "KINT", to: "KINT", stops: [["KGSO", 3]] }],
        total: 1.0, solo: 1.0, dayFs: 1, dayTg: 3, notes: "Over to Greensboro for touch-and-goes on the big runway. Busy, but the tower kept it moving." },
      { key: "o2", daysAgo: 6, at: "09:30", aircraft: "N3517G", legs: [{ from: "KINT", to: "KHKY" }, { from: "KHKY", to: "KINT" }],
        total: 2.8, dual: 2.8, xc: 2.8, dayFs: 2, instructor: "Pat Riley",
        notes: "Dual cross-country to Hickory. Grandfather Mountain off the right wing on the way back." },
    ] },
  { key: "ben", firstName: "Ben", lastName: "Whitaker", goal: "private", aircraft: ["N48911"],
    flights: [
      { key: "b1", daysAgo: 24, at: "10:00", aircraft: "N48911", legs: [{ from: "KJNX", to: "KJNX" }], extraCircuits: 4,
        total: 1.1, dual: 1.1, dayFs: 1, dayTg: 4, instructor: "Dana Shaw", notes: "Gusty crosswinds at Johnston County. Lots of rudder." },
      { key: "b2", daysAgo: 12, at: "14:00", aircraft: "N48911", legs: [{ from: "KJNX", to: "KJNX" }], practice: { area: "jnxEast", maneuvers: ["steep", "stalls"] },
        total: 1.0, solo: 1.0, dayFs: 1, notes: "Solo out over the farmland east of Smithfield. Steep turns with I-95 as my reference line." },
      { key: "b3", daysAgo: 1, at: "09:15", aircraft: "N48911", legs: [{ from: "KJNX", to: "KEWN" }, { from: "KEWN", to: "KJNX" }],
        total: 2.6, solo: 2.6, xc: 2.6, dayFs: 2,
        notes: "First solo cross-country! New Bern and back in the 152. Headwind out, tailwind home." },
    ] },
  { key: "emily", firstName: "Emily", lastName: "Chen", goal: "instrument", aircraft: ["N745DS"],
    checkrides: [{ key: "checkride", goal: "private", daysAgo: 12 }],
    flights: [
      { key: "e1", daysAgo: 14, at: "10:30", aircraft: "N745DS", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "stalls", "circle"] },
        total: 1.3, dual: 1.3, dayFs: 1, instructor: MIKE, notes: "Last lesson before the checkride. Everything felt sharp." },
      { key: "e2", daysAgo: 12, at: "09:00", aircraft: "N745DS", legs: [{ from: "KTTA", to: "KTTA", stops: [["KHRJ", 1]] }], practice: { area: "ttaWest", maneuvers: ["steep", "sturns"] },
        total: 1.8, pic: 1.8, dayFs: 1, dayTg: 1,
        notes: "Checkride! Diversion to Harnett, steep turns, an emergency descent, and a short-field landing to finish." },
      { key: "e3", daysAgo: 2, at: "12:00", aircraft: "N745DS", legs: [{ from: "KTTA", to: "KSOP" }, { from: "KSOP", to: "KTTA" }],
        total: 1.9, pic: 1.9, dayFs: 2, notes: "First passenger flight! Took my sister to Pinehurst for lunch. She wants to go again 💕" },
    ] },
  { key: "sarah", firstName: "Sarah", lastName: "Lindqvist", goal: "instrument", aircraft: ["N5309B"],
    flights: [
      { key: "s1", daysAgo: 20, at: "07:00", aircraft: "N5309B", legs: [{ from: "KAPA", to: "KASE" }],
        total: 1.3, pic: 1.3, xc: 1.3, dayFs: 1,
        notes: "Over the Divide to Aspen for the weekend, early to beat the afternoon winds. Independence Pass from above is unreal." },
      { key: "s2", daysAgo: 17, at: "08:30", aircraft: "N5309B", legs: [{ from: "KASE", to: "KEGE" }, { from: "KEGE", to: "KAPA" }],
        total: 1.6, pic: 1.6, xc: 1.6, dayFs: 2, notes: "Home from Aspen by way of Eagle for cheaper fuel. Glassy air over the Flat Tops." },
    ] },
  { key: "megan", firstName: "Megan", lastName: "O'Connell", goal: "private", aircraft: ["N36395", "N8092E"],
    flights: [
      { key: "g1", daysAgo: 23, at: "19:50", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], extraCircuits: 3,
        total: 1.4, dual: 1.4, night: 1.4, nightFs: 5, instructor: MIKE, notes: "Night lesson. Five full-stop landings with the Raleigh glow off to the northeast." },
      { key: "g2", daysAgo: 9, at: "11:15", aircraft: "N36395", legs: [{ from: "KTTA", to: "KTTA" }], practice: { area: "ttaWest", maneuvers: ["steep", "circle"] },
        total: 1.1, solo: 1.1, dayFs: 1, notes: "Solo practice area day. Turns around a point over a Chatham County farm pond." },
      { key: "g3", daysAgo: 5, at: "10:00", aircraft: "N8092E", legs: [{ from: "KTTA", to: "KGSO" }, { from: "KGSO", to: "KTTA" }],
        total: 2.0, dual: 2.0, xc: 2.0, dayFs: 2, instructor: MIKE,
        notes: "Dual cross-country to Greensboro: my first Class C landing, behind a regional jet." },
    ] },
];

// Comments, by post ("person.flight" or "person.checkride"): who wrote it, what, and how many
// minutes after the post went up.
export const COMMENTS: Record<string, [author: string, body: string, minutesAfter: number][]> = {
  "ethan.f8": [
    ["ryan", "Welcome to the solo club!! 🎉", 12],
    ["emily", "The empty seat thing is SO real", 40],
    ["megan", "Shirt tail time 😂", 75],
    ["nate", "Nice work. Enjoy it, you only get one first solo.", 190],
    ["ethan", "Thanks everyone! Still grinning", 240],
  ],
  "ethan.f13": [
    ["tyler", "Wilmington and Oak Island is such a good first XC", 30],
    ["marcus", "Beach pics or it didn't happen", 55],
    ["ethan", "Next time, promise 📸", 80],
  ],
  "ethan.f15": [
    ["megan", "Smith Reynolds is such a cool airport", 25],
    ["ethan", "Tower was great with a student 😅", 60],
    ["ryan", "How was the haze over the Triad?", 95],
    ["ethan", "Clear as anything after the front came through", 120],
  ],
  "ethan.f19": [
    ["chris", "Smart call diverting. That's exactly the decision they want to see", 45],
    ["ryan", "Fayetteville tower is the best place to wait out a storm 😅", 80],
    ["ethan", "Watched it roll through from the FBO. Zero regrets", 110],
  ],
  "ethan.f21": [
    ["daniel", "169 nm solo is no joke. Congrats!", 20],
    ["sarah", "Fayetteville Approach is so helpful 😍", 50],
    ["owen", "Rocky Mount is a great fuel stop", 70],
    ["nate", "That's the one you remember. Well flown.", 140],
    ["ethan", "Thanks all! Fayetteville tower was super chill", 180],
  ],
  "ethan.f25": [
    ["emily", "Let's goooo 🙌", 15],
    ["ryan", "Checkride next! You've got this", 35],
    ["ben", "Nice! Who's your examiner?", 90],
    ["ethan", "Scheduling now, hoping for early December", 130],
  ],
  "ethan.f26": [
    ["tyler", "Power-off 180s are my nemesis lol", 20],
    ["megan", "Good luck!! 🤞", 45],
  ],
  "ryan.checkride": [
    ["ethan", "LET'S GO RYAN 🎉🎉", 5],
    ["emily", "Congrats, Captain!", 18],
    ["tyler", "Welcome to the club ✈️", 33],
    ["jake", "Huge congrats!", 60],
    ["ryan", "Thanks everyone! The oral was mostly airspace and weather. Cleanest steep turns I've ever flown 😅", 85],
    ["marcus", "Instrument next 😏", 110],
  ],
  "emily.checkride": [
    ["ethan", "Congrats Emily!! So well deserved", 9],
    ["megan", "So proud of you 💕", 22],
    ["sarah", "Amazing!! 🎉", 48],
    ["emily", "Thank you!! Still can't believe it", 70],
  ],
  "marcus.checkride": [
    ["nate", "Welcome to the cloud club ☁️", 14],
    ["tyler", "Teach me your ways", 40],
    ["ethan", "Congrats man, that's a grind", 65],
  ],
  "tyler.checkride": [
    ["ethan", "Congrats!!", 10],
    ["ryan", "Nicely done 👏", 26],
  ],
  "marcus.m3": [
    ["ben", "Asheville brunch is the best $100 hamburger", 30],
    ["ethan", "Adding this to the list", 55],
  ],
  "nate.n1": [
    ["owen", "Landing at First Flight is a bucket-list one", 40],
    ["tyler", "Hatteras lighthouse from the air 🔥", 75],
  ],
  "tyler.t2": [
    ["emily", "Your dad must have loved it", 25],
    ["tyler", "He didn't stop taking pictures the whole way", 50],
  ],
  "daniel.d1": [
    ["chris", "Coastal solo XC, nice!", 35],
    ["ethan", "The Bogue Banks must look amazing from up there", 70],
  ],
  "sarah.s1": [
    ["ethan", "Mountain flying into Aspen is next level", 30],
    ["sarah", "Climbing at 300 fpm out of Centennial on a warm morning is humbling 😂", 55],
  ],
  "marcus.m4": [
    ["ethan", "Charleston is on my list once I pass 😍", 18],
    ["nate", "Myrtle for fuel is the move. Cheaper than CHS", 41],
    ["marcus", "Exactly why I stopped 😂", 63],
  ],
  "jake.j1": [
    ["ethan", "Welcome to the addiction 😄", 15],
    ["megan", "You're going to love it", 40],
  ],
  "emily.e3": [["ethan", "Nice first passenger trip!", 25]],
  "ben.b3": [
    ["owen", "New Bern is a great XC stop", 20],
    ["ethan", "First solo XC!! 🙌", 45],
  ],
  "owen.o2": [
    ["ben", "Hickory! Did you see Grandfather Mountain?", 30],
    ["owen", "Right off the right wing on the way home", 50],
  ],
  "megan.g1": [["ethan", "Night landings at TTA are the best", 20]],
  "chris.c1": [["daniel", "Palomar looks awesome from above", 60]],
};

// Posts nearly everyone gives props to. Other posts get props from some friends at random.
export const MILESTONES = new Set([
  "ethan.f8", "ethan.f13", "ethan.f21", "ethan.f25", "marcus.m4", "nate.n1",
  "ryan.checkride", "emily.checkride", "marcus.checkride", "tyler.checkride",
  "tyler.t2", "ben.b3", "emily.e3", "marcus.m3",
]);
