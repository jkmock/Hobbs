\restrict dbmate

-- Dumped from database version 17.6 (Debian 17.6-1.pgdg12+1)
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger;


--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger_data;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aircraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft (
    aircraft_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tail_number text NOT NULL,
    aircraft_make text NOT NULL,
    aircraft_model text NOT NULL,
    aircraft_year smallint,
    aircraft_category text NOT NULL,
    aircraft_class text NOT NULL,
    is_tailwheel boolean DEFAULT false NOT NULL,
    is_complex boolean DEFAULT false NOT NULL,
    is_high_perf boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT aircraft_aircraft_category_check CHECK ((aircraft_category = 'airplane'::text)),
    CONSTRAINT aircraft_aircraft_class_check CHECK ((aircraft_class = ANY (ARRAY['single_engine_land'::text, 'multi_engine_land'::text]))),
    CONSTRAINT aircraft_aircraft_year_check CHECK ((aircraft_year >= 1903)),
    CONSTRAINT aircraft_tail_number_check CHECK ((tail_number = upper(tail_number)))
);


--
-- Name: airports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.airports (
    airport_id uuid DEFAULT gen_random_uuid() NOT NULL,
    airport_ident text NOT NULL,
    airport_type text NOT NULL,
    airport_name text NOT NULL,
    airport_location public.geography(Point,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    faa_code text,
    elevation_ft integer,
    CONSTRAINT airports_airport_ident_check CHECK ((airport_ident = upper(airport_ident))),
    CONSTRAINT airports_airport_type_check CHECK ((airport_type = ANY (ARRAY['small_airport'::text, 'medium_airport'::text, 'large_airport'::text, 'closed'::text]))),
    CONSTRAINT airports_faa_code_check CHECK ((faa_code = upper(faa_code)))
);


--
-- Name: flight_leg_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flight_leg_stops (
    stop_id uuid DEFAULT gen_random_uuid() NOT NULL,
    leg_id uuid NOT NULL,
    stop_order smallint NOT NULL,
    airport_id uuid NOT NULL,
    touch_and_goes smallint NOT NULL,
    CONSTRAINT flight_leg_stops_stop_order_check CHECK ((stop_order >= 1)),
    CONSTRAINT flight_leg_stops_touch_and_goes_check CHECK (((touch_and_goes >= 1) AND (touch_and_goes <= 99)))
);


--
-- Name: flight_legs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flight_legs (
    leg_id uuid DEFAULT gen_random_uuid() NOT NULL,
    flight_id uuid NOT NULL,
    leg_order smallint NOT NULL,
    origin_id uuid NOT NULL,
    destination_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    fa_flight_id text,
    track public.geography(LineString,4326),
    leg_time numeric(3,1),
    CONSTRAINT flight_legs_leg_order_check CHECK ((leg_order >= 1)),
    CONSTRAINT flight_legs_leg_time_check CHECK (((leg_time >= (0)::numeric) AND (leg_time <= (24)::numeric)))
);


--
-- Name: flightaware_tracks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flightaware_tracks (
    fa_flight_id text NOT NULL,
    track public.geography(LineString,4326),
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    altitudes smallint[]
);


--
-- Name: flightaware_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flightaware_usage (
    usage_id uuid DEFAULT gen_random_uuid() NOT NULL,
    endpoint text NOT NULL,
    cost_usd numeric(8,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT flightaware_usage_cost_usd_check CHECK ((cost_usd >= (0)::numeric))
);


--
-- Name: flights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flights (
    flight_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    instructor_id uuid,
    flight_date date NOT NULL,
    aircraft_id uuid NOT NULL,
    total_time numeric(4,1) NOT NULL,
    departure_time timestamp with time zone,
    arrival_time timestamp with time zone,
    dual_received_time numeric(4,1) DEFAULT 0 NOT NULL,
    solo_time numeric(4,1) DEFAULT 0 NOT NULL,
    pic_time numeric(4,1) DEFAULT 0 NOT NULL,
    cross_country_time numeric(4,1) DEFAULT 0 NOT NULL,
    night_time numeric(4,1) DEFAULT 0 NOT NULL,
    actual_instrument_time numeric(4,1) DEFAULT 0 NOT NULL,
    simulated_instrument_time numeric(4,1) DEFAULT 0 NOT NULL,
    day_landings_fs smallint DEFAULT 0 NOT NULL,
    day_landings_tg smallint DEFAULT 0 NOT NULL,
    night_landings_fs smallint DEFAULT 0 NOT NULL,
    night_landings_tg smallint DEFAULT 0 NOT NULL,
    instrument_approaches smallint DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sic_time numeric(4,1) DEFAULT 0 NOT NULL,
    CONSTRAINT arrival_after_departure CHECK ((arrival_time > departure_time)),
    CONSTRAINT dual_and_solo_time_sum CHECK (((dual_received_time + solo_time) <= total_time)),
    CONSTRAINT flights_check CHECK (((dual_received_time >= (0)::numeric) AND (dual_received_time <= total_time))),
    CONSTRAINT flights_check1 CHECK (((solo_time >= (0)::numeric) AND (solo_time <= total_time))),
    CONSTRAINT flights_check2 CHECK (((pic_time >= (0)::numeric) AND (pic_time <= total_time))),
    CONSTRAINT flights_check3 CHECK (((cross_country_time >= (0)::numeric) AND (cross_country_time <= total_time))),
    CONSTRAINT flights_check4 CHECK (((night_time >= (0)::numeric) AND (night_time <= total_time))),
    CONSTRAINT flights_check5 CHECK (((actual_instrument_time >= (0)::numeric) AND (actual_instrument_time <= total_time))),
    CONSTRAINT flights_check6 CHECK (((simulated_instrument_time >= (0)::numeric) AND (simulated_instrument_time <= total_time))),
    CONSTRAINT flights_check7 CHECK (((sic_time >= (0)::numeric) AND (sic_time <= total_time))),
    CONSTRAINT flights_day_landings_fs_check CHECK ((day_landings_fs >= 0)),
    CONSTRAINT flights_day_landings_tg_check CHECK ((day_landings_tg >= 0)),
    CONSTRAINT flights_instrument_approaches_check CHECK ((instrument_approaches >= 0)),
    CONSTRAINT flights_night_landings_fs_check CHECK ((night_landings_fs >= 0)),
    CONSTRAINT flights_night_landings_tg_check CHECK ((night_landings_tg >= 0)),
    CONSTRAINT flights_total_time_check CHECK ((total_time > (0)::numeric))
);


--
-- Name: instructors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.instructors (
    instructor_id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    token_hash text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: user_aircraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_aircraft (
    user_id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    removed_at timestamp with time zone
);


--
-- Name: user_identities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_identities (
    identity_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_identities_provider_check CHECK ((provider = 'google'::text))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email public.citext NOT NULL,
    password_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: aircraft aircraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_pkey PRIMARY KEY (aircraft_id);


--
-- Name: aircraft aircraft_tail_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_tail_number_key UNIQUE (tail_number);


--
-- Name: airports airports_airport_ident_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_airport_ident_key UNIQUE (airport_ident);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (airport_id);


--
-- Name: flight_leg_stops flight_leg_stops_leg_id_stop_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_leg_stops
    ADD CONSTRAINT flight_leg_stops_leg_id_stop_order_key UNIQUE (leg_id, stop_order);


--
-- Name: flight_leg_stops flight_leg_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_leg_stops
    ADD CONSTRAINT flight_leg_stops_pkey PRIMARY KEY (stop_id);


--
-- Name: flight_legs flight_legs_flight_id_leg_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_legs
    ADD CONSTRAINT flight_legs_flight_id_leg_order_key UNIQUE (flight_id, leg_order);


--
-- Name: flight_legs flight_legs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_legs
    ADD CONSTRAINT flight_legs_pkey PRIMARY KEY (leg_id);


--
-- Name: flightaware_tracks flightaware_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flightaware_tracks
    ADD CONSTRAINT flightaware_tracks_pkey PRIMARY KEY (fa_flight_id);


--
-- Name: flightaware_usage flightaware_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flightaware_usage
    ADD CONSTRAINT flightaware_usage_pkey PRIMARY KEY (usage_id);


--
-- Name: flights flights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_pkey PRIMARY KEY (flight_id);


--
-- Name: user_identities identity_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT identity_unique UNIQUE (provider, provider_user_id);


--
-- Name: instructors instructors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_pkey PRIMARY KEY (instructor_id);


--
-- Name: instructors instructors_student_id_first_name_last_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_student_id_first_name_last_name_key UNIQUE (student_id, first_name, last_name);


--
-- Name: user_identities one_identity_per_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT one_identity_per_provider UNIQUE (user_id, provider);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (token_hash);


--
-- Name: user_aircraft user_aircraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_aircraft
    ADD CONSTRAINT user_aircraft_pkey PRIMARY KEY (user_id, aircraft_id);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (identity_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: airports_faa_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX airports_faa_code_idx ON public.airports USING btree (faa_code);


--
-- Name: airports_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX airports_location_idx ON public.airports USING gist (airport_location);


--
-- Name: flight_legs_destination_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flight_legs_destination_idx ON public.flight_legs USING btree (destination_id);


--
-- Name: flight_legs_origin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flight_legs_origin_idx ON public.flight_legs USING btree (origin_id);


--
-- Name: flightaware_usage_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flightaware_usage_created_idx ON public.flightaware_usage USING btree (created_at);


--
-- Name: flights_aircraft_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flights_aircraft_idx ON public.flights USING btree (aircraft_id);


--
-- Name: flights_instructor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flights_instructor_idx ON public.flights USING btree (instructor_id);


--
-- Name: flights_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flights_user_date_idx ON public.flights USING btree (user_id, flight_date DESC);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: aircraft aircraft_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER aircraft_set_updated_at BEFORE UPDATE ON public.aircraft FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: airports airports_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER airports_set_updated_at BEFORE UPDATE ON public.airports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: flights flights_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER flights_set_updated_at BEFORE UPDATE ON public.flights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: instructors instructors_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER instructors_set_updated_at BEFORE UPDATE ON public.instructors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: flight_leg_stops flight_leg_stops_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_leg_stops
    ADD CONSTRAINT flight_leg_stops_airport_id_fkey FOREIGN KEY (airport_id) REFERENCES public.airports(airport_id);


--
-- Name: flight_leg_stops flight_leg_stops_leg_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_leg_stops
    ADD CONSTRAINT flight_leg_stops_leg_id_fkey FOREIGN KEY (leg_id) REFERENCES public.flight_legs(leg_id) ON DELETE CASCADE;


--
-- Name: flight_legs flight_legs_destination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_legs
    ADD CONSTRAINT flight_legs_destination_id_fkey FOREIGN KEY (destination_id) REFERENCES public.airports(airport_id);


--
-- Name: flight_legs flight_legs_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_legs
    ADD CONSTRAINT flight_legs_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(flight_id) ON DELETE CASCADE;


--
-- Name: flight_legs flight_legs_origin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_legs
    ADD CONSTRAINT flight_legs_origin_id_fkey FOREIGN KEY (origin_id) REFERENCES public.airports(airport_id);


--
-- Name: flights flights_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(aircraft_id);


--
-- Name: flights flights_instructor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.instructors(instructor_id);


--
-- Name: flights flights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: instructors instructors_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.instructors
    ADD CONSTRAINT instructors_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_aircraft user_aircraft_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_aircraft
    ADD CONSTRAINT user_aircraft_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(aircraft_id) ON DELETE CASCADE;


--
-- Name: user_aircraft user_aircraft_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_aircraft
    ADD CONSTRAINT user_aircraft_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict dbmate


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('20261012160800'),
    ('20261013003421'),
    ('20261103045707'),
    ('20261111180000'),
    ('20261111190000'),
    ('20261111200000'),
    ('20261111210000'),
    ('20261111220000'),
    ('20261112120000'),
    ('20261112130000'),
    ('20261112140000'),
    ('20261112150000');
