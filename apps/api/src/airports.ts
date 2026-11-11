import { pool } from "./db.js";

// Turning what a pilot types into an airport. US pilots usually type the FAA code (RDU),
// not the ICAO code (KRDU), and many small fields only have an FAA code (W99, 1N7).
//
// A code matches, in this order:
//   1. an airport's FAA code (RDU -> KRDU, ANC -> PANC, W99 -> KW99)
//   2. an airport's stored identifier (KRDU)
//   3. K + the code, for anything else typed without the K
// The FAA code comes first because it's what pilots use, and it's what the app shows:
// a leg displayed as RDU must find the same airport again when the flight is saved.
// If two airports share an FAA code (a few duplicates in the source data), the larger one wins.

export type ResolvedAirport = {
  id: string;
  ident: string; // stored identifier, e.g. KRDU
  code: string; // what the app shows: the FAA code, or the identifier when there is none
};

// The column expression for the code to show, for queries that select airports directly.
export const DISPLAY_CODE = (alias: string) => `COALESCE(${alias}.faa_code, ${alias}.airport_ident)`;

export async function resolveAirports(codes: string[]): Promise<Map<string, ResolvedAirport>> {
  const wanted = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const resolved = new Map<string, ResolvedAirport>();
  if (wanted.length === 0) return resolved;

  const result = await pool.query(
    `SELECT DISTINCT ON (q.code)
            q.code,
            a.airport_id    AS id,
            a.airport_ident AS ident,
            ${DISPLAY_CODE("a")} AS display
     FROM unnest($1::text[]) AS q(code)
     JOIN airports a
       ON a.faa_code = q.code OR a.airport_ident = q.code OR a.airport_ident = 'K' || q.code
     ORDER BY q.code,
              COALESCE(a.faa_code = q.code, false) DESC,
              (a.airport_ident = q.code) DESC,
              CASE a.airport_type WHEN 'large_airport' THEN 3 WHEN 'medium_airport' THEN 2 ELSE 1 END DESC,
              a.airport_ident`,
    [wanted],
  );
  for (const row of result.rows) {
    resolved.set(row.code, { id: row.id, ident: row.ident, code: row.display });
  }
  return resolved;
}
