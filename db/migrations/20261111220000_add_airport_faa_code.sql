-- migrate:up

-- The FAA identifier US pilots actually type: RDU for KRDU, ANC for PANC, W99 for a field
-- with no ICAO code. airport_ident stays as the stored key; lookups also match faa_code.
-- Filled in by db/seeds/airports.sql (OurAirports' local_code column).
ALTER TABLE airports ADD COLUMN faa_code text CHECK (faa_code = upper(faa_code));

CREATE INDEX airports_faa_code_idx ON airports (faa_code);

-- migrate:down

DROP INDEX IF EXISTS airports_faa_code_idx;
ALTER TABLE airports DROP COLUMN IF EXISTS faa_code;
