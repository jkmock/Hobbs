CREATE TEMP TABLE staging_airports (
    id text,
    ident text,
    type text,
    name text,
    latitude_deg text,
    longitude_deg text,
    elevation_ft text,
    continent text,
    iso_country text,
    iso_region text,
    municipality text,
    scheduled_service text,
    icao_code text,
    iata_code text,
    gps_code text,
    local_code text,
    home_link text,
    wikipedia_link text,
    keywords text
);

\copy staging_airports FROM 'data/airports.csv' WITH (FORMAT csv, HEADER true)

INSERT INTO airports (airport_ident, airport_type, airport_name, airport_location, faa_code, elevation_ft)
SELECT
  upper(ident),
  type,
  name,
  ST_SetSRID(ST_MakePoint(longitude_deg::double precision, latitude_deg::double precision), 4326)::geography,
  NULLIF(upper(trim(local_code)), ''),
  NULLIF(trim(elevation_ft), '')::integer
FROM staging_airports
WHERE iso_country = 'US'
  AND type IN ('small_airport', 'medium_airport', 'large_airport')
ON CONFLICT (airport_ident) DO UPDATE
  SET airport_type     = EXCLUDED.airport_type,
      airport_name     = EXCLUDED.airport_name,
      airport_location = EXCLUDED.airport_location,
      faa_code         = EXCLUDED.faa_code,
      elevation_ft     = EXCLUDED.elevation_ft
  WHERE (airports.airport_type, airports.airport_name, airports.faa_code, airports.elevation_ft)
        IS DISTINCT FROM (EXCLUDED.airport_type, EXCLUDED.airport_name, EXCLUDED.faa_code, EXCLUDED.elevation_ft)
     OR NOT ST_Equals(airports.airport_location::geometry, EXCLUDED.airport_location::geometry);