-- =====================================================================
-- VastgoedCo — Portfolio dashboard & forecast engine (Supabase / PostgreSQL)
--
-- Plak dit volledige script in Supabase → SQL Editor → Run.
-- Het maakt: tabellen, voorbeelddata, een 24-maanden forecast in drie
-- scenario's (base / upside / downside), KPI's en meldingen.
--
-- LET OP: het script begint met het verwijderen van deze tabellen, zodat je
-- het opnieuw kunt draaien. Eigen data in deze tabellen gaat dan verloren.
--
-- Handige queries na afloop (onderaan dit bestand staan er meer):
--   select * from v_kpi;
--   select * from v_meldingen;
--   select * from v_forecast where scenario = 'base';
--
-- Afspraken:
--   * bedragen in euro; *_pct velden zijn percentages (4.2 = 4,2%)
--   * alle berekeningen gaan uit van instelling.peildatum
-- =====================================================================

drop view if exists v_kpi, v_meldingen, v_forecast, v_forecast_events, v_scenario cascade;
drop table if exists cash_event, crediteur, verkoop, acquisitie, bouwtermijn,
  tranche, herfinanciering, lening, kosten, huurcontract, object, kasstand,
  scenario_parameter, instelling, entiteit cascade;
drop function if exists fmt_eur(numeric), fmt_maand(date), fmt_datum(date);

-- ---------------------------------------------------------------------
-- 1. Hulpfuncties voor Nederlandse opmaak
-- ---------------------------------------------------------------------
create function fmt_maand(d date) returns text language sql immutable as $$
  select (array['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'])
         [extract(month from d)::int] || ' ' || extract(year from d)::int
$$;

create function fmt_datum(d date) returns text language sql immutable as $$
  select extract(day from d)::int || ' ' || fmt_maand(d)
$$;

create function fmt_eur(x numeric) returns text language sql immutable as $$
  select case when x < 0 then '−' else '' end || case
    when abs(x) >= 1000000 then '€ ' || replace(to_char(round(abs(x) / 1000000, 1), 'FM999990.0'), '.', ',') || 'M'
    when abs(x) >= 100000  then '€ ' || round(abs(x) / 1000)::text || 'k'
    else '€ ' || replace(to_char(round(abs(x)), 'FM999G999G990'), ',', '.')
  end
$$;

-- ---------------------------------------------------------------------
-- 2. Tabellen
-- ---------------------------------------------------------------------
create table instelling (
  id              int primary key default 1 check (id = 1),   -- precies één rij
  bedrijfsnaam    text not null,
  peildatum       date not null,
  min_kasbuffer   numeric(14,2) not null default 500000,
  horizon_mnd     int not null default 24
);

create table entiteit (
  id        serial primary key,
  naam      text not null,
  type      text not null default 'project_bv'
            check (type in ('holding','werkmaatschappij','project_bv','stichting'))
);

create table object (
  id                    serial primary key,
  entiteit_id           int references entiteit(id),
  naam                  text not null,
  stad                  text,
  type                  text check (type in ('woning','appartementen','kantoor','retail','bedrijfsruimte','gemengd','grond')),
  status                text not null
                        check (status in ('acquisitie','ontwikkeling','bouw','eigendom','verkoop','verkocht')),
  aankoopprijs          numeric(14,2),
  marktwaarde           numeric(14,2),      -- v1: laatste taxatie / eigen inschatting
  irr_verwacht_pct      numeric(6,2),       -- v1: input; in v2 berekend
  geplande_oplevering   date,               -- bij bouw/ontwikkeling
  verwachte_oplevering  date
);

create table huurcontract (
  id                 serial primary key,
  object_id          int not null references object(id) on delete cascade,
  huurder            text not null,
  huur_maand         numeric(14,2) not null,
  ingangsdatum       date not null,
  einddatum          date,                  -- leeg = onbepaalde tijd
  indexatie_type     text not null default 'geen' check (indexatie_type in ('vast','cpi','geen')),
  indexatie_pct      numeric(6,2) default 0, -- bij 'vast'
  indexatiemaand     int default 1 check (indexatiemaand between 1 and 12)
);

create table kosten (
  id            serial primary key,
  object_id     int references object(id) on delete cascade,  -- leeg = overhead
  omschrijving  text not null,
  categorie     text not null default 'overig'
                check (categorie in ('onderhoud','beheer','verzekering','ozb','vve','overhead','belasting','overig')),
  bedrag_jaar   numeric(14,2) not null
);

create table lening (
  id                  serial primary key,
  object_id           int references object(id),
  naam                text not null,
  geldgever           text,
  type                text not null
                      check (type in ('hypotheek','bouwfinanciering','mezzanine','aandeelhouderslening','overbrugging')),
  status              text not null default 'actief'
                      check (status in ('aangevraagd','toegezegd','actief','afgelost')),
  hoofdsom            numeric(14,2) not null,       -- totale faciliteit
  uitstaand_saldo     numeric(14,2) not null,       -- op peildatum
  rente_pct           numeric(6,3) not null,
  rente_cash          boolean not null default true, -- false = rente wordt bijgeschreven (bouw)
  aflossingstype      text not null default 'bullet' check (aflossingstype in ('lineair','bullet')),
  aflossing_maand     numeric(14,2) not null default 0,
  einddatum           date not null,
  covenant_dscr_min   numeric(5,2),
  covenant_ltv_max    numeric(5,2)
);

create table tranche (
  id                 serial primary key,
  lening_id          int not null references lening(id) on delete cascade,
  volgnummer         int not null,
  bedrag             numeric(14,2) not null,
  verwachte_datum    date not null,
  werkelijke_datum   date,
  status             text not null default 'gepland'
                     check (status in ('gepland','ingediend','goedgekeurd','getrokken'))
);

create table bouwtermijn (
  id             serial primary key,
  object_id      int not null references object(id) on delete cascade,
  omschrijving   text,
  bedrag         numeric(14,2) not null,
  verwachte_datum date not null,
  status         text not null default 'gepland' check (status in ('gepland','gefactureerd','betaald'))
);

create table herfinanciering (
  id                  serial primary key,
  object_id           int not null references object(id),
  oude_lening_id      int references lening(id),
  verwachte_datum     date not null,
  nieuwe_hoofdsom     numeric(14,2) not null,
  nieuwe_rente_pct    numeric(6,3),          -- leeg = scenario-aanname
  kosten              numeric(14,2) not null default 0,
  status              text not null default 'gepland'
                      check (status in ('gepland','aangevraagd','termsheet','toegezegd','afgerond'))
);

create table acquisitie (
  id                     serial primary key,
  object_id              int not null references object(id),
  fase                   text not null
                         check (fase in ('orientatie','due_diligence','bod','koopovereenkomst','financiering_rond','gepasseerd','afgeblazen')),
  koopsom                numeric(14,2) not null,
  overdrachtsbelasting_pct numeric(5,2) not null default 10.4,
  bijkomende_kosten      numeric(14,2) not null default 0,
  financiering_bedrag    numeric(14,2) not null default 0,
  waarborgsom            numeric(14,2) not null default 0,
  waarborgsom_datum      date,
  waarborgsom_betaald    boolean not null default false,
  passeerdatum           date not null,
  kans_pct               numeric(5,2) default 100,
  meenemen_in_forecast   boolean not null default true
);

create table verkoop (
  id                  serial primary key,
  object_id           int not null references object(id),
  verwachte_prijs     numeric(14,2) not null,
  verkoopkosten_pct   numeric(5,2) not null default 1.5,
  aflossing_leningen  numeric(14,2) not null default 0,  -- af te lossen schuld bij verkoop
  verwachte_datum     date not null,
  status              text not null default 'intentie'
                      check (status in ('intentie','in_verkoop','onder_bod','verkocht','geleverd'))
);

create table crediteur (
  id                    serial primary key,
  naam                  text not null,
  type                  text check (type in ('leverancier','aannemer','overheid','bank','overig')),
  openstaand_bedrag     numeric(14,2) not null,
  vervaldatum           date,
  aanmaningsstatus      text not null default 'geen'
                        check (aanmaningsstatus in ('geen','1e_aanmaning','2e_aanmaning','sommatie','juridisch')),
  regeling              boolean not null default false,
  termijnbedrag         numeric(14,2),
  frequentie            text check (frequentie in ('wekelijks','maandelijks','kwartaal')),
  volgende_betaaldatum  date,
  einddatum_regeling    date,
  status                text not null default 'lopend' check (status in ('lopend','achter','afgerond'))
);

create table kasstand (
  id          serial primary key,
  entiteit_id int references entiteit(id),
  rekening    text,
  peildatum   date not null,
  saldo       numeric(14,2) not null
);

create table cash_event (      -- handmatige, eenmalige kasstromen
  id           serial primary key,
  object_id    int references object(id),
  datum        date not null,
  bedrag       numeric(14,2) not null,   -- + ontvangst, − uitgave
  omschrijving text not null,
  scenario     text check (scenario in ('base','upside','downside'))  -- leeg = alle scenario's
);

create table scenario_parameter (
  scenario  text not null check (scenario in ('base','upside','downside')),
  sleutel   text not null,
  waarde    numeric not null,
  toelichting text,
  primary key (scenario, sleutel)
);

-- Supabase: RLS aan zonder policies = niet leesbaar via de publieke API.
-- De SQL Editor en het dashboard (postgres-rol) werken gewoon.
do $$
declare t text;
begin
  foreach t in array array['instelling','entiteit','object','huurcontract','kosten','lening',
    'tranche','bouwtermijn','herfinanciering','acquisitie','verkoop','crediteur','kasstand',
    'cash_event','scenario_parameter']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Voorbeelddata (VastgoedCo, peildatum april 2026)
-- ---------------------------------------------------------------------
insert into instelling (bedrijfsnaam, peildatum, min_kasbuffer) values ('VastgoedCo', '2026-04-30', 500000);

insert into entiteit (naam, type) values
  ('VastgoedCo Holding BV', 'holding'),
  ('VastgoedCo Vastgoed BV', 'werkmaatschappij'),
  ('Project Amsterdam BV', 'project_bv');

insert into object (entiteit_id, naam, stad, type, status, aankoopprijs, marktwaarde, irr_verwacht_pct, geplande_oplevering, verwachte_oplevering) values
  (2, 'Utrecht',   'Utrecht',   'kantoor',       'eigendom',   4300000, 5200000, 10.5, null, null),
  (2, 'Rotterdam', 'Rotterdam', 'gemengd',       'eigendom',   2900000, 3400000,  9.8, null, null),
  (2, 'Breda',     'Breda',     'bedrijfsruimte','eigendom',   3300000, 4100000, 11.5, null, null),
  (3, 'Amsterdam', 'Amsterdam', 'appartementen', 'bouw',       1200000, 3600000, 13.5, '2027-06-30', '2027-06-30'),
  (2, 'Den Bosch', 's-Hertogenbosch', 'kantoor', 'acquisitie', null,    null,    null, null, null);

insert into huurcontract (object_id, huurder, huur_maand, ingangsdatum, einddatum, indexatie_type, indexatie_pct, indexatiemaand) values
  (1, 'Adviesbureau Noord',  32000, '2021-01-01', '2030-12-31', 'vast', 2.5, 1),
  (2, 'Huurder Rotterdam A',  8400, '2022-01-01', '2027-01-01', 'cpi',  0,   7),
  (2, 'Huurder Rotterdam B', 14600, '2023-07-01', '2029-06-30', 'cpi',  0,   7),
  (3, 'Logistiek Breda BV',  17000, '2024-01-01', '2031-12-31', 'vast', 2.0, 1),
  (4, 'Verhuur 24 appartementen', 34800, '2027-07-01', null, 'cpi', 0, 7);   -- start na oplevering

insert into kosten (object_id, omschrijving, categorie, bedrag_jaar) values
  (1,    'Exploitatie Utrecht',   'overig',   60000),
  (2,    'Exploitatie Rotterdam', 'overig',   40000),
  (3,    'Exploitatie Breda',     'overig',   44000),
  (null, 'Organisatiekosten',     'overhead', 216000);

insert into lening (object_id, naam, geldgever, type, hoofdsom, uitstaand_saldo, rente_pct, rente_cash, aflossingstype, aflossing_maand, einddatum, covenant_dscr_min, covenant_ltv_max) values
  (1, 'Lening Utrecht',          'ING',       'hypotheek',        2300000, 2300000, 4.2, true,  'bullet',  0,     '2026-08-15', 1.20, 65),
  (2, 'Lening Rotterdam',        'ABN AMRO',  'hypotheek',        2400000, 1900000, 4.6, true,  'lineair', 10000, '2030-12-31', 1.20, 65),
  (3, 'Lening Breda',            'Rabobank',  'hypotheek',        2300000, 2050000, 5.0, true,  'lineair', 8375,  '2027-03-31', 1.20, 65),
  (4, 'Bouwfinanciering Amsterdam', 'Triodos','bouwfinanciering', 3000000, 1350000, 6.0, false, 'bullet',  0,     '2027-12-31', null, 70);

insert into tranche (lening_id, volgnummer, bedrag, verwachte_datum, werkelijke_datum, status) values
  (4, 1, 450000, '2025-11-15', '2025-11-15', 'getrokken'),
  (4, 2, 450000, '2026-01-20', '2026-01-20', 'getrokken'),
  (4, 3, 450000, '2026-04-03', '2026-04-03', 'getrokken'),
  (4, 4, 600000, '2026-07-15', null, 'goedgekeurd'),
  (4, 5, 450000, '2026-11-15', null, 'gepland'),
  (4, 6, 450000, '2027-01-15', null, 'gepland'),
  (4, 7, 150000, '2027-04-15', null, 'gepland');

insert into bouwtermijn (object_id, omschrijving, bedrag, verwachte_datum) values
  (4, 'Termijn 6 – casco',          120000, '2026-05-10'),
  (4, 'Termijn 7 – casco',          120000, '2026-06-10'),
  (4, 'Termijn 8 – gevel',          120000, '2026-07-10'),
  (4, 'Termijn 9 – gevel',          120000, '2026-08-10'),
  (4, 'Termijn 10 – dak',           120000, '2026-09-10'),
  (4, 'Termijn 11 – installaties',  120000, '2026-10-10'),
  (4, 'Termijn 12 – installaties',  120000, '2026-11-10'),
  (4, 'Termijn 13 – afbouw',        120000, '2026-12-10'),
  (4, 'Termijn 14 – afbouw',        120000, '2027-01-10'),
  (4, 'Termijn 15 – afbouw',        120000, '2027-02-10'),
  (4, 'Termijn 16 – afbouw',        120000, '2027-03-10'),
  (4, 'Termijn 17 – terrein',       120000, '2027-04-10'),
  (4, 'Termijn 18 – oplevering',    120000, '2027-06-10');

insert into herfinanciering (object_id, oude_lening_id, verwachte_datum, nieuwe_hoofdsom, nieuwe_rente_pct, kosten, status) values
  (3, 3, '2026-11-01', 2600000, 4.75, 45000, 'gepland'),
  (4, 4, '2027-08-01', 4400000, null,  60000, 'gepland');   -- bouwlening → langlopende hypotheek

insert into acquisitie (object_id, fase, koopsom, overdrachtsbelasting_pct, bijkomende_kosten, financiering_bedrag, waarborgsom, waarborgsom_datum, passeerdatum, kans_pct, meenemen_in_forecast) values
  (5, 'bod', 3200000, 10.4, 60000, 2080000, 320000, '2026-09-01', '2027-03-01', 60, false);

insert into crediteur (naam, type, openstaand_bedrag, vervaldatum, aanmaningsstatus, regeling, termijnbedrag, frequentie, volgende_betaaldatum, einddatum_regeling, status) values
  ('Belastingdienst',        'overheid',    36600, '2026-02-28', 'geen', true,  3050, 'maandelijks', '2026-05-28', '2027-04-28', 'lopend'),
  ('Installatiebedrijf Oost','leverancier', 12400, '2026-06-15', 'geen', false, null, null, null, null, 'lopend');

insert into kasstand (entiteit_id, rekening, peildatum, saldo) values
  (1, 'ING zakelijk',       '2026-03-31', 1516000),
  (2, 'Rabobank zakelijk',  '2026-03-31',  900000),
  (3, 'Projectrekening',    '2026-03-31',  300000),
  (1, 'ING zakelijk',       '2026-04-30', 1580000),
  (2, 'Rabobank zakelijk',  '2026-04-30',  960000),
  (3, 'Projectrekening',    '2026-04-30',  300000);

insert into scenario_parameter (scenario, sleutel, waarde, toelichting) values
  ('base','cpi_pct',2.5,'CPI-indexatie huur'),                   ('upside','cpi_pct',3.0,null),                 ('downside','cpi_pct',1.5,null),
  ('base','leegstand_pct',0,'Extra leegstand op alle huur'),     ('upside','leegstand_pct',0,null),             ('downside','leegstand_pct',5,null),
  ('base','huur_na_einde_pct',50,'Deel van huur dat doorloopt na einddatum contract'),
                                                                 ('upside','huur_na_einde_pct',100,null),       ('downside','huur_na_einde_pct',0,null),
  ('base','kostenstijging_pct',3.0,'Jaarlijkse kostenstijging'), ('upside','kostenstijging_pct',2.5,null),      ('downside','kostenstijging_pct',5.0,null),
  ('base','vertraging_herfi_mnd',0,'Vertraging herfinanciering'),('upside','vertraging_herfi_mnd',0,null),      ('downside','vertraging_herfi_mnd',3,null),
  ('base','vertraging_bouw_mnd',0,'Vertraging bouwtermijnen en tranches'),
                                                                 ('upside','vertraging_bouw_mnd',0,null),       ('downside','vertraging_bouw_mnd',3,null),
  ('base','bouwkosten_overschrijding_pct',0,'Extra bouwkosten'), ('upside','bouwkosten_overschrijding_pct',0,null), ('downside','bouwkosten_overschrijding_pct',8,null),
  ('base','vertraging_aankoop_mnd',0,'Vertraging passeren'),     ('upside','vertraging_aankoop_mnd',0,null),    ('downside','vertraging_aankoop_mnd',2,null),
  ('base','herfi_opbrengst_pct',100,'Nieuwe hoofdsom t.o.v. plan'), ('upside','herfi_opbrengst_pct',105,null),  ('downside','herfi_opbrengst_pct',85,null),
  ('base','rente_nieuw_pct',4.75,'Rente nieuwe leningen'),       ('upside','rente_nieuw_pct',4.25,null),        ('downside','rente_nieuw_pct',5.75,null),
  ('base','verkoopprijs_afwijking_pct',0,'Afwijking verkoopprijs'), ('upside','verkoopprijs_afwijking_pct',5,null), ('downside','verkoopprijs_afwijking_pct',-10,null),
  ('base','vertraging_verkoop_mnd',0,'Vertraging verkoop'),      ('upside','vertraging_verkoop_mnd',0,null),    ('downside','vertraging_verkoop_mnd',6,null);

-- ---------------------------------------------------------------------
-- 4. Forecast engine
-- ---------------------------------------------------------------------

-- Scenario-parameters als kolommen
create view v_scenario with (security_invoker = true) as
select scenario,
  max(waarde) filter (where sleutel = 'cpi_pct')                      as cpi_pct,
  max(waarde) filter (where sleutel = 'leegstand_pct')                as leegstand_pct,
  max(waarde) filter (where sleutel = 'huur_na_einde_pct')            as huur_na_einde_pct,
  max(waarde) filter (where sleutel = 'kostenstijging_pct')           as kostenstijging_pct,
  max(waarde) filter (where sleutel = 'vertraging_herfi_mnd')::int    as vertraging_herfi_mnd,
  max(waarde) filter (where sleutel = 'vertraging_bouw_mnd')::int     as vertraging_bouw_mnd,
  max(waarde) filter (where sleutel = 'bouwkosten_overschrijding_pct') as bouwkosten_overschrijding_pct,
  max(waarde) filter (where sleutel = 'vertraging_aankoop_mnd')::int  as vertraging_aankoop_mnd,
  max(waarde) filter (where sleutel = 'herfi_opbrengst_pct')          as herfi_opbrengst_pct,
  max(waarde) filter (where sleutel = 'rente_nieuw_pct')              as rente_nieuw_pct,
  max(waarde) filter (where sleutel = 'verkoopprijs_afwijking_pct')   as verkoopprijs_afwijking_pct,
  max(waarde) filter (where sleutel = 'vertraging_verkoop_mnd')::int  as vertraging_verkoop_mnd
from scenario_parameter
group by scenario;

-- Alle kasstromen per scenario, maand en bron (drill-down)
create view v_forecast_events with (security_invoker = true) as
with
p as (select peildatum, date_trunc('month', peildatum)::date as m0, horizon_mnd from instelling),
m as (
  select s.*, gs.n, (p.m0 + make_interval(months => gs.n))::date as maand, p.peildatum, p.m0
  from v_scenario s cross join p cross join generate_series(1, p.horizon_mnd) gs(n)
),
-- effectieve datums van herfinancieringen per scenario
herfi as (
  select s.scenario, h.*,
         date_trunc('month', h.verwachte_datum + make_interval(months => s.vertraging_herfi_mnd))::date as herfi_maand,
         h.nieuwe_hoofdsom * s.herfi_opbrengst_pct / 100 as hoofdsom_eff,
         coalesce(h.nieuwe_rente_pct, s.rente_nieuw_pct) as rente_eff
  from herfinanciering h cross join v_scenario s
  where h.status <> 'afgerond'
),
-- leningen met maand van aflossing (einddatum, of eerder bij herfinanciering)
len as (
  select s.scenario, s.vertraging_bouw_mnd, l.*,
         least(date_trunc('month', l.einddatum)::date, hf.herfi_maand) as aflos_maand
  from lening l cross join v_scenario s
  left join herfi hf on hf.oude_lening_id = l.id and hf.scenario = s.scenario
  where l.status = 'actief'
),
-- saldo per lening aan het begin van elke maand: na aflossing, plus nog te trekken
-- tranches en bijgeschreven rente (bouwfinanciering)
lsal0 as (
  select m.scenario, m.n, m.maand, l.id as lening_id,
         greatest(0, l.uitstaand_saldo - l.aflossing_maand * (m.n - 1)) + tc.cum as basis
  from m join len l on l.scenario = m.scenario and m.maand <= l.aflos_maand
  cross join lateral (
    select coalesce(sum(t.bedrag), 0) as cum from tranche t
    where t.lening_id = l.id and t.status <> 'getrokken'
      and date_trunc('month', t.verwachte_datum + make_interval(months => l.vertraging_bouw_mnd)) < m.maand
  ) tc
),
lsal as (
  select s0.*, l.object_id, l.naam, l.rente_pct, l.rente_cash, l.aflossing_maand, l.aflos_maand,
         s0.basis + case when l.rente_cash then 0 else coalesce(sum(s0.basis * l.rente_pct / 100 / 12)
           over (partition by s0.scenario, s0.lening_id order by s0.n rows between unbounded preceding and 1 preceding), 0) end as saldo
  from lsal0 s0 join len l on l.id = s0.lening_id and l.scenario = s0.scenario
)
-- Huur
select m.scenario, m.maand, 'huur'::text as categorie, o.id as object_id, o.naam as object,
       h.huurder as omschrijving,
       round(h.huur_maand
         * power(1 + case h.indexatie_type when 'vast' then h.indexatie_pct when 'cpi' then m.cpi_pct else 0 end / 100,
                 (select count(*) from generate_series(extract(year from m.peildatum)::int, extract(year from m.maand)::int) y
                   where make_date(y, h.indexatiemaand, 1) > m.peildatum and make_date(y, h.indexatiemaand, 1) <= m.maand))
         * (1 - m.leegstand_pct / 100)
         * case when h.einddatum is not null and m.maand >= h.einddatum then m.huur_na_einde_pct / 100 else 1 end, 2) as bedrag
from m join huurcontract h on true
join object o on o.id = h.object_id and o.status not in ('verkocht')
  and h.ingangsdatum + make_interval(months => case when o.status in ('bouw','ontwikkeling') then m.vertraging_bouw_mnd else 0 end)
      < (m.maand + interval '1 month')
union all
-- Exploitatiekosten en overhead
select m.scenario, m.maand, case when k.object_id is null then 'overhead' else 'exploitatie' end, k.object_id, o.naam,
       k.omschrijving,
       round(-k.bedrag_jaar / 12 * power(1 + m.kostenstijging_pct / 100,
             extract(year from m.maand) - extract(year from m.peildatum)), 2)
from m cross join kosten k left join object o on o.id = k.object_id
union all
-- Rente (alleen cash-rente)
select l.scenario, l.maand, 'rente', l.object_id, o.naam, l.naam,
       round(-l.saldo * l.rente_pct / 100 / 12, 2)
from lsal l left join object o on o.id = l.object_id
where l.rente_cash
union all
-- Reguliere aflossing
select l.scenario, l.maand, 'aflossing', l.object_id, o.naam, l.naam,
       -least(l.aflossing_maand, l.saldo)
from lsal l left join object o on o.id = l.object_id
where l.maand < l.aflos_maand and l.aflossing_maand > 0
union all
-- Aflossing restsaldo op einddatum / bij herfinanciering
select l.scenario, l.maand, 'lening_afloop', l.object_id, o.naam, l.naam || ' – aflossing restsaldo',
       round(-l.saldo, 2)
from lsal l left join object o on o.id = l.object_id
where l.maand = l.aflos_maand
union all
-- Herfinanciering: opname nieuwe lening minus kosten
select m.scenario, m.maand, 'herfinanciering', hf.object_id, o.naam, 'Herfinanciering – nieuwe lening',
       hf.hoofdsom_eff - hf.kosten
from m join herfi hf on hf.scenario = m.scenario and m.maand = hf.herfi_maand
join object o on o.id = hf.object_id
union all
-- Rente op nieuwe lening na herfinanciering
select m.scenario, m.maand, 'rente', hf.object_id, o.naam, 'Rente nieuwe lening',
       round(-hf.hoofdsom_eff * hf.rente_eff / 100 / 12, 2)
from m join herfi hf on hf.scenario = m.scenario and m.maand > hf.herfi_maand
join object o on o.id = hf.object_id
union all
-- Bouwtermijnen aannemer
select m.scenario, m.maand, 'bouw', b.object_id, o.naam, b.omschrijving,
       round(-b.bedrag * (1 + m.bouwkosten_overschrijding_pct / 100), 2)
from m join bouwtermijn b
  on b.status <> 'betaald'
 and date_trunc('month', b.verwachte_datum + make_interval(months => m.vertraging_bouw_mnd)) = m.maand
join object o on o.id = b.object_id
union all
-- Tranche-opnames bouwfinanciering
select m.scenario, m.maand, 'tranche', l.object_id, o.naam, l.naam || ' – tranche ' || t.volgnummer,
       t.bedrag
from m join tranche t
  on t.status <> 'getrokken'
 and date_trunc('month', t.verwachte_datum + make_interval(months => m.vertraging_bouw_mnd)) = m.maand
join lening l on l.id = t.lening_id
left join object o on o.id = l.object_id
union all
-- Aankoop: waarborgsom
select m.scenario, m.maand, 'aankoop', a.object_id, o.naam, 'Waarborgsom',
       -a.waarborgsom
from m join acquisitie a
  on a.meenemen_in_forecast and not a.waarborgsom_betaald and a.waarborgsom > 0
 and a.fase not in ('gepasseerd','afgeblazen')
 and date_trunc('month', a.waarborgsom_datum) = m.maand
join object o on o.id = a.object_id
union all
-- Aankoop: eigen inbreng op passeerdatum
select m.scenario, m.maand, 'aankoop', a.object_id, o.naam, 'Passeren – eigen inbreng en kosten',
       -(a.koopsom * (1 + a.overdrachtsbelasting_pct / 100) + a.bijkomende_kosten
         - a.financiering_bedrag - a.waarborgsom)
from m join acquisitie a
  on a.meenemen_in_forecast and a.fase not in ('gepasseerd','afgeblazen')
 and date_trunc('month', a.passeerdatum + make_interval(months => m.vertraging_aankoop_mnd)) = m.maand
join object o on o.id = a.object_id
union all
-- Verkoop: netto opbrengst
select m.scenario, m.maand, 'verkoop', v.object_id, o.naam, 'Verkoop – netto opbrengst',
       round(v.verwachte_prijs * (1 + m.verkoopprijs_afwijking_pct / 100) * (1 - v.verkoopkosten_pct / 100)
             - v.aflossing_leningen, 2)
from m join verkoop v
  on v.status not in ('verkocht','geleverd')
 and date_trunc('month', v.verwachte_datum + make_interval(months => m.vertraging_verkoop_mnd)) = m.maand
join object o on o.id = v.object_id
union all
-- Crediteuren met betaalregeling: termijnen
select m.scenario, m.maand, 'crediteuren', null, null, c.naam || ' – termijn',
       -c.termijnbedrag * count(*)
from m join crediteur c on c.regeling and c.status <> 'afgerond'
join lateral generate_series(c.volgende_betaaldatum, c.einddatum_regeling,
       case c.frequentie when 'wekelijks' then interval '1 week' when 'kwartaal' then interval '3 months' else interval '1 month' end) d(dag)
  on date_trunc('month', d.dag) = m.maand
group by m.scenario, m.maand, c.naam, c.termijnbedrag
union all
-- Crediteuren zonder regeling: op vervaldatum (vervallen = eerste forecastmaand)
select m.scenario, m.maand, 'crediteuren', null, null, c.naam,
       -c.openstaand_bedrag
from m join crediteur c on not c.regeling and c.status <> 'afgerond'
 and greatest(date_trunc('month', c.vervaldatum)::date, (m.m0 + interval '1 month')::date) = m.maand
union all
-- Handmatige cash events
select m.scenario, m.maand, 'overig', e.object_id, o.naam, e.omschrijving, e.bedrag
from m join cash_event e on date_trunc('month', e.datum) = m.maand and (e.scenario is null or e.scenario = m.scenario)
left join object o on o.id = e.object_id;

-- Maandoverzicht per scenario met kasaldo
create view v_forecast with (security_invoker = true) as
with p as (select peildatum, min_kasbuffer from instelling),
start as (
  select coalesce(sum(saldo), 0) as kas
  from kasstand where peildatum = (select max(k.peildatum) from kasstand k, p where k.peildatum <= p.peildatum)
),
agg as (
  select scenario, maand,
    sum(bedrag) filter (where categorie = 'huur')                                  as huur,
    sum(bedrag) filter (where categorie = 'exploitatie')                           as exploitatie,
    sum(bedrag) filter (where categorie in ('huur','exploitatie'))                 as noi,
    sum(bedrag) filter (where categorie = 'overhead')                              as overhead,
    sum(bedrag) filter (where categorie = 'rente')                                 as rente,
    sum(bedrag) filter (where categorie = 'aflossing')                             as aflossing,
    sum(bedrag) filter (where categorie = 'lening_afloop')                         as lening_afloop,
    sum(bedrag) filter (where categorie = 'herfinanciering')                       as herfinanciering,
    sum(bedrag) filter (where categorie = 'bouw')                                  as bouw,
    sum(bedrag) filter (where categorie = 'tranche')                               as tranches,
    sum(bedrag) filter (where categorie = 'aankoop')                               as aankoop,
    sum(bedrag) filter (where categorie = 'verkoop')                               as verkoop,
    sum(bedrag) filter (where categorie = 'crediteuren')                           as crediteuren,
    sum(bedrag) filter (where categorie = 'overig')                                as overig,
    sum(bedrag)                                                                    as netto_kasstroom
  from v_forecast_events
  group by scenario, maand
)
select a.scenario, a.maand, fmt_maand(a.maand) as maand_label,
  coalesce(huur,0) huur, coalesce(exploitatie,0) exploitatie, coalesce(noi,0) noi,
  coalesce(overhead,0) overhead, coalesce(rente,0) rente, coalesce(aflossing,0) aflossing,
  coalesce(lening_afloop,0) lening_afloop, coalesce(herfinanciering,0) herfinanciering,
  coalesce(bouw,0) bouw, coalesce(tranches,0) tranches, coalesce(aankoop,0) aankoop,
  coalesce(verkoop,0) verkoop, coalesce(crediteuren,0) crediteuren, coalesce(overig,0) overig,
  netto_kasstroom,
  start.kas + sum(netto_kasstroom) over (partition by a.scenario order by a.maand) as kasaldo_eind,
  case
    when start.kas + sum(netto_kasstroom) over (partition by a.scenario order by a.maand) < 0 then 'rood'
    when start.kas + sum(netto_kasstroom) over (partition by a.scenario order by a.maand) < p.min_kasbuffer then 'oranje'
    else 'groen'
  end as status
from agg a cross join start cross join p;

-- ---------------------------------------------------------------------
-- 5. Meldingen (alerts)
-- ---------------------------------------------------------------------
create view v_meldingen with (security_invoker = true) as
with p as (select peildatum, min_kasbuffer from instelling),
eerste_tekort as (
  select f.scenario, f.maand, f.kasaldo_eind,
         row_number() over (partition by f.scenario order by f.maand) rn
  from v_forecast f, p where f.kasaldo_eind < p.min_kasbuffer
),
eerste_negatief as (
  select distinct on (scenario) scenario, maand
  from v_forecast where kasaldo_eind < 0 order by scenario, maand
),
laagste as (
  select distinct on (scenario) scenario, maand, kasaldo_eind
  from v_forecast order by scenario, kasaldo_eind, maand
),
volgende_herfi as (
  select h.verwachte_datum, o.naam
  from herfinanciering h join object o on o.id = h.object_id
  where h.status <> 'afgerond'
  order by h.verwachte_datum limit 1
)
-- 1. Kasaldo onder buffer (base) of negatief (downside)
select 1 as prio, 'kritiek'::text as niveau,
  'Kasaldo daalt onder ' || fmt_eur(p.min_kasbuffer) || ' in ' || fmt_maand(e.maand)
  || ' (laagste punt ' || fmt_eur(l.kasaldo_eind) || ' in ' || fmt_maand(l.maand) || ').'
  || coalesce(' Herfinanciering ' || vh.naam || ' (gepland ' || fmt_maand(vh.verwachte_datum) || ') tijdig afronden.', '') as melding,
  'liquiditeit'::text as categorie
from eerste_tekort e join laagste l on l.scenario = e.scenario cross join p
left join volgende_herfi vh on true
where e.scenario = 'base' and e.rn = 1
union all
select 1, 'kritiek',
  'Downside: kasaldo wordt negatief in ' || fmt_maand(e.maand) || ' (' || fmt_eur(l.kasaldo_eind)
  || ' op dieptepunt in ' || fmt_maand(l.maand) || ').',
  'liquiditeit'
from eerste_negatief e join laagste l on l.scenario = e.scenario
where e.scenario = 'downside'
union all
-- 2. Lening loopt binnen 12 maanden af zonder ingediende herfinanciering
select 2, 'kritiek',
  l.naam || ' (' || fmt_eur(l.uitstaand_saldo) || ') loopt af ' || fmt_datum(l.einddatum) || '. '
  || case when h.id is null then 'Geen herfi-aanvraag ingediend.' else 'Herfinanciering nog niet aangevraagd.' end
  || ' Doorlooptijd 8–12 weken.',
  'financiering'
from lening l cross join p
left join herfinanciering h on h.oude_lening_id = l.id
where l.status = 'actief' and l.type <> 'bouwfinanciering'
  and l.einddatum <= p.peildatum + interval '12 months'
  and (h.id is null or h.status = 'gepland')
  and (h.id is null or h.verwachte_datum > l.einddatum - interval '1 month')
union all
-- 3. Huurcontract verloopt binnen 9 maanden
select 3, 'aandacht',
  'Huurcontract ' || o.naam || ' (' || fmt_eur(h.huur_maand) || '/mnd) verloopt ' || fmt_datum(h.einddatum)
  || '. Heronderhandeling advies ' || fmt_maand((h.einddatum - interval '4 months')::date) || '.',
  'asset'
from huurcontract h join object o on o.id = h.object_id cross join p
where h.einddatum between p.peildatum and p.peildatum + interval '9 months'
union all
-- 4. Bouwvertraging
select 3, 'aandacht',
  'Bouwproject ' || o.naam || ' vertraagd: oplevering ' || fmt_datum(o.verwachte_oplevering)
  || ' i.p.v. ' || fmt_datum(o.geplande_oplevering) || '.',
  'bouw'
from object o
where o.status = 'bouw' and o.verwachte_oplevering > o.geplande_oplevering + interval '30 days'
union all
-- 5. Crediteur: termijn binnen 7 dagen of achterstand
select case when c.status = 'achter' or c.aanmaningsstatus in ('sommatie','juridisch') then 2 else 3 end,
  case when c.status = 'achter' or c.aanmaningsstatus in ('sommatie','juridisch') then 'kritiek' else 'aandacht' end,
  'Crediteur ' || c.naam || ': ' ||
  case when c.status = 'achter' then 'betaalregeling loopt achter.'
       when c.aanmaningsstatus in ('sommatie','juridisch') then replace(c.aanmaningsstatus, '_', ' ') || ' ontvangen.'
       else 'termijn ' || fmt_eur(c.termijnbedrag) || ' vervalt ' || fmt_datum(c.volgende_betaaldatum) || '.' end,
  'crediteuren'
from crediteur c cross join p
where c.status <> 'afgerond'
  and (c.status = 'achter' or c.aanmaningsstatus in ('sommatie','juridisch')
       or (c.regeling and c.volgende_betaaldatum between p.peildatum and p.peildatum + 7))
union all
-- 6. Info: tranche recent getrokken en bouw op schema
select 9, 'info',
  'Bouwproject ' || o.naam || case when o.verwachte_oplevering <= o.geplande_oplevering then ' op schema.' else '.' end
  || ' Tranche ' || t.volgnummer || ' (' || fmt_eur(t.bedrag) || ') getrokken ' || fmt_datum(t.werkelijke_datum) || '.',
  'bouw'
from tranche t join lening l on l.id = t.lening_id join object o on o.id = l.object_id cross join p
where t.status = 'getrokken' and t.werkelijke_datum > p.peildatum - interval '60 days';

-- ---------------------------------------------------------------------
-- 6. KPI's (management overzicht, scenario base)
-- ---------------------------------------------------------------------
create view v_kpi with (security_invoker = true) as
with p as (select * from instelling),
kas_nu as (
  select peildatum, sum(saldo) saldo from kasstand
  where peildatum = (select max(k.peildatum) from kasstand k, p where k.peildatum <= p.peildatum)
  group by peildatum
),
kas_vorig as (
  select sum(saldo) saldo from kasstand
  where peildatum = (select max(k.peildatum) from kasstand k, kas_nu where k.peildatum < kas_nu.peildatum)
),
min12 as (
  select maand, kasaldo_eind from v_forecast f, p
  where scenario = 'base' and maand <= date_trunc('month', p.peildatum) + interval '12 months'
  order by kasaldo_eind, maand limit 1
),
schuld as (
  select coalesce(sum(uitstaand_saldo), 0) totaal,
         coalesce(sum(uitstaand_saldo * rente_pct / 100 + aflossing_maand * 12) filter (where rente_cash), 0) schuldendienst,
         min(covenant_dscr_min) dscr_min
  from lening where status = 'actief'
),
waarde as (
  select coalesce(sum(marktwaarde), 0) mw from object where status in ('eigendom','bouw','ontwikkeling','verkoop')
),
noi as (
  select (select coalesce(sum(h.huur_maand) * 12, 0) from huurcontract h, p
           where h.ingangsdatum <= p.peildatum and (h.einddatum is null or h.einddatum > p.peildatum))
       - (select coalesce(sum(k.bedrag_jaar), 0) from kosten k join object o on o.id = k.object_id
           where o.status = 'eigendom') as jaar
),
irr as (
  select sum(o.irr_verwacht_pct * (o.marktwaarde - coalesce(l.schuld, 0)))
         / nullif(sum(o.marktwaarde - coalesce(l.schuld, 0)), 0) as gewogen
  from object o
  left join (select object_id, sum(uitstaand_saldo) schuld from lening where status = 'actief' group by object_id) l
    on l.object_id = o.id
  where o.irr_verwacht_pct is not null and o.marktwaarde is not null
),
alerts as (
  select count(*) filter (where niveau = 'kritiek') kritiek,
         count(*) filter (where niveau = 'aandacht') aandacht
  from v_meldingen
)
select
  p.bedrijfsnaam,
  fmt_maand(p.peildatum)                                   as periode,
  kas_nu.saldo                                             as kasaldo_vandaag,
  kas_nu.saldo - kas_vorig.saldo                           as kasaldo_mutatie,
  min12.kasaldo_eind                                       as min_kasaldo_12m,
  fmt_maand(min12.maand)                                   as min_kasaldo_maand,
  waarde.mw - schuld.totaal                                as nav,
  round(noi.jaar / nullif(schuld.schuldendienst, 0), 2)    as dscr,
  schuld.dscr_min                                          as dscr_min_eis,
  noi.jaar                                                 as noi_jaar,
  (select count(*) from object where status = 'eigendom')  as actieve_objecten,
  round(irr.gewogen, 1)                                    as portefeuille_irr_pct,
  schuld.totaal                                            as totale_schuld,
  round(100 * schuld.totaal / nullif(waarde.mw, 0))        as ltv_pct,
  alerts.kritiek + alerts.aandacht                         as actieve_alerts,
  alerts.kritiek                                           as alerts_kritiek,
  alerts.aandacht                                          as alerts_aandacht
from p, kas_nu, kas_vorig, min12, schuld, waarde, noi, irr, alerts;

-- =====================================================================
-- Klaar. Probeer:
--
--   select * from v_kpi;                                           -- tegels bovenaan
--   select niveau, melding from v_meldingen order by prio;         -- actieve meldingen
--   select maand_label, scenario, kasaldo_eind, status
--     from v_forecast order by maand, scenario;                    -- kasverloop 24 mnd
--   select * from v_forecast_events
--    where scenario = 'downside' and maand = '2026-11-01';         -- drill-down één maand
--
-- Scenario aanpassen, bijv. 6 maanden bouwvertraging in downside:
--   update scenario_parameter set waarde = 6
--    where scenario = 'downside' and sleutel = 'vertraging_bouw_mnd';
-- =====================================================================
