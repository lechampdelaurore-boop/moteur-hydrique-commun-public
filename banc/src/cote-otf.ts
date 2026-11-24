/**
 * Le côté OTF du banc (contrat du banc, § 2, § 5 et § 7 ter) : chaque lundi,
 * l'objectif de la semaine de chaque parcelle est l'ETM de la semaine ; le
 * besoin puis le placement sont ceux du module OTF, appelés tels quels
 * (`buildIrrigationNeedsDashboard`, puis `buildWeeklyPlan` avec ses réglages
 * par défaut), sans rien modifier du module.
 *
 * Passe 1 (prévisions parfaites, débit sans limite, § 6) :
 *  - la pluie prévue est la pluie réalisée (réanalyse, total du jour) ;
 *  - une parcelle de la démo devient une planche d'OTF de même surface, dans
 *    un jardin « serre » ou « plein champ », avec un seul matériel ;
 *  - une pompe et une ressource sans limite pratique, aucune limite par jour ;
 *  - chaque proposition est validée et faite telle quelle.
 * Avec des prévisions parfaites et une exécution parfaite, un nouveau calcul
 * en cours de semaine ne trouve rien de nouveau : un calcul par semaine, le
 * lundi à minuit, suffit, et la stabilité d'OTF vaut 0 par construction.
 *
 * Le module est chargé à part (`chargerModuleOtf`), depuis un clone du dépôt
 * public du module à un commit noté dans le rapport.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bornesDuJour, type ArrosageDuJour } from '../../src/moteur.ts';
import { jourSuivant, joursEntre } from './dates.ts';
import type { JourMeteo } from './meteo.ts';

export type ModuleOtf = {
  buildIrrigationNeedsDashboard: (input: any) => any;
  buildWeeklyPlan: (inputs: any, settings: any) => any;
  reglages: any;
  /** Le commit du clone du module ; null s'il n'a pas pu être lu. */
  commit: string | null;
};

/** Charge la logique du module depuis un clone de son dépôt public. */
export async function chargerModuleOtf(racine: string): Promise<ModuleOtf> {
  const charger = (f: string) => import(pathToFileURL(path.join(racine, f)).href);
  const [besoins, moteur, reglages] = await Promise.all([
    charger('lib/domain/irrigation-needs.ts'),
    charger('lib/domain/planning/engine.ts'),
    charger('lib/domain/planning/settings.ts'),
  ]);
  let commit: string | null = null;
  try {
    commit = execFileSync('git', ['-C', racine, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    commit = null;
  }
  return {
    buildIrrigationNeedsDashboard: besoins.buildIrrigationNeedsDashboard,
    buildWeeklyPlan: moteur.buildWeeklyPlan,
    reglages: reglages.DEFAULT_PLANNING_SETTINGS,
    commit,
  };
}

export type MaterielOtf = { kind: 'drip' | 'sprinkler'; debit_mm_h: number };
export type ParcelleOtf = { id: string; serre: boolean; surface_m2: number; materiel: MaterielOtf };

export type SemaineOtf = {
  lundi: string;
  objectif_mm: number;
  besoin_mm: number;
  place_mm: number;
  non_place_mm: number;
  raisons: string[];
};

export type ResultatOtf = { arrosages: ArrosageDuJour[]; semaines: SemaineOtf[] };

const FUSEAU = 'Europe/Paris';
const ZONE = 'banc';
/** Sans limite pratique (passe 1, débit sans limite) : m³/h. */
const DEBIT_SANS_LIMITE = 1e6;

/** Le premier lundi à partir de `date`. */
export function premierLundi(date: string): string {
  let d = date;
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 1) d = jourSuivant(d);
  return d;
}

function ferme(parcelles: readonly ParcelleOtf[], saison: number) {
  const plots = parcelles.map((p) => ({ id: p.id, zoneId: ZONE, name: p.id, mode: p.serre ? 'greenhouse' : 'garden', length: p.surface_m2, width: 1, area: p.surface_m2, seasons: [saison] }));
  const beds = parcelles.map((p) => ({ id: p.id, zoneId: ZONE, plotId: p.id, name: p.id, length: p.surface_m2, width: 1, alleyWidth: 0, area: p.surface_m2, seasons: [saison] }));
  const equipment = parcelles.map((p) => ({
    id: `vanne-${p.id}`, name: `vanne ${p.id}`, kind: p.materiel.kind, mobility: 'fixed', status: 'active', settingsCount: 1, archivedAt: null,
    settings: [p.materiel.kind === 'drip'
      ? { id: `reglage-${p.id}`, name: 'banc', position: 1, kind: 'drip', rateMmPerHour: p.materiel.debit_mm_h }
      : { id: `reglage-${p.id}`, name: 'banc', position: 1, kind: 'sprinkler', leftProfile: [{ distanceMeters: 0, rateMmPerHour: p.materiel.debit_mm_h }], rightProfile: [{ distanceMeters: 0, rateMmPerHour: p.materiel.debit_mm_h }] }],
  }));
  const coverage = parcelles.map((p) => ({
    bedId: p.id, totalRateMmPerHour: p.materiel.debit_mm_h,
    contributions: [{ equipmentId: `vanne-${p.id}`, equipmentName: `vanne ${p.id}`, settingId: `reglage-${p.id}`, settingName: 'banc', kind: p.materiel.kind, rateMmPerHour: p.materiel.debit_mm_h }],
  }));
  const placements = parcelles.map((p) => ({
    id: `pose-${p.id}`, equipmentId: `vanne-${p.id}`, settingId: `reglage-${p.id}`, season: saison, gardenGroupId: null,
    otfZoneId: ZONE, otfPlotId: p.id, anchor: { type: 'bed_center', anchorBedOtfId: p.id },
    selectedBeds: p.materiel.kind === 'drip' ? [{ otfZoneId: ZONE, otfPlotId: p.id, otfBedId: p.id }] : [],
  }));
  const pumps = [{
    id: 'pompe', name: 'pompe', maximumFlowCubicMetersPerHour: DEBIT_SANS_LIMITE, status: 'active', archivedAt: null, notes: null,
    origins: [{ id: 'origine', pumpId: 'pompe', sourceKind: 'resource', resourceId: 'source', reservoirId: null, isDefault: true }],
  }];
  const infrastructure = {
    resources: [{ id: 'source', name: 'source', type: 'borehole', nominalFlowCubicMetersPerHour: DEBIT_SANS_LIMITE, status: 'active', availableFrom: null, availableUntil: null, notes: null }],
    resourceLimits: [], reservoirs: [], resourceReservoirLinks: [], reservoirLinks: [],
    defaultSupply: { sourceKind: 'resource', resourceId: 'source', reservoirId: null },
    movements: [],
  };
  const snapshot = {
    configuration: {}, structure: {}, zones: [{ id: ZONE, name: ZONE, area: null, seasons: [saison] }], plots, beds,
    source: 'mock', lastSuccessfulReadAt: '1970-01-01T00:00:00.000Z',
  };
  return { snapshot, beds, equipment, coverage, placements, pumps, pumpDefaults: equipment.map((e) => ({ equipmentId: e.id, pumpId: 'pompe' })), infrastructure };
}

/**
 * Rejoue le côté OTF, du premier lundi à partir de `debut` à la semaine qui
 * contient `fin`. `etm` : l'ETM de chaque parcelle, jour par jour, sur toute
 * cette période (la même que celle du juge).
 */
export function rejouerOtf(
  module: ModuleOtf,
  parcelles: readonly ParcelleOtf[],
  etm: ReadonlyMap<string, ReadonlyMap<string, number | null>>,
  meteo: readonly JourMeteo[],
  debut: string,
  fin: string,
  saison: number,
): Map<string, ResultatOtf> {
  const pluie = new Map(meteo.map((m) => [m.date, m.pluie_mm]));
  const et0 = new Map(meteo.map((m) => [m.date, m.et0_mm]));
  const f = ferme(parcelles, saison);
  const resultats = new Map(parcelles.map((p) => [p.id, { arrosages: [] as ArrosageDuJour[], semaines: [] as SemaineOtf[] }]));

  for (let lundi = premierLundi(debut); lundi <= fin; lundi = jourSuivant(lundi, 7)) {
    const dimanche = jourSuivant(lundi, 6);
    const jours = joursEntre(lundi, dimanche);
    const now = new Date(bornesDuJour(lundi, FUSEAU).debut);
    const objectifs = new Map(parcelles.map((p) => {
      const serie = etm.get(p.id);
      if (!serie) throw new Error(`${p.id} : pas d'ETM`);
      const valeurs = jours.map((d) => serie.get(d));
      if (valeurs.some((v) => v === undefined || v === null)) throw new Error(`${p.id} : ETM inconnue dans la semaine du ${lundi}`);
      return [p.id, (valeurs as number[]).reduce((s, v) => s + v, 0)];
    }));
    const goalRevisions = parcelles.map((p) => ({
      id: `objectif-${p.id}-${lundi}`, weekStart: lundi, scopeType: 'bed', otfZoneId: ZONE, otfPlotId: p.id, otfBedId: p.id,
      amountMm: objectifs.get(p.id)!, action: 'set', createdAt: now.toISOString(), copiedFromGoalId: null,
    }));
    // Passe 1 : la pluie prévue est la pluie réalisée.
    const days = jours.map((date) => {
      const mm = pluie.get(date);
      if (mm === undefined || mm === null) throw new Error(`le ${date} : pluie inconnue`);
      return {
        date, volumeIncomplete: false, realizedIrrigationCubicMeters: 0, plannedIrrigationCubicMeters: 0, estimatedOngoingCubicMeters: 0,
        reanalysisRainMm: mm, manualRainMm: null, effectiveActualRainMm: mm, forecastRainMm: mm,
        forecastMinimumTemperatureCelsius: null, forecastMaximumTemperatureCelsius: null,
        et0Mm: et0.get(date) ?? null, et0Kind: 'reanalysis', limitCubicMeters: null, limitExceededByCubicMeters: 0, actualLimitExceededByCubicMeters: 0,
      };
    });
    const tableau = module.buildIrrigationNeedsDashboard({
      season: saison, snapshot: f.snapshot, days, events: [], goalRevisions, decisions: [], coverage: f.coverage,
      thresholdMm: 0, weekStart: lundi, weekEnd: dimanche, now,
    });
    const needs = tableau.gardens.flatMap((g: any) => g.beds);
    const plan = module.buildWeeklyPlan({
      season: saison, now, weekStart: lundi, weekEnd: dimanche, timeZone: FUSEAU, needs, beds: f.beds,
      days: days.map((d) => ({ date: d.date, forecastRainMm: d.forecastRainMm, et0Mm: d.et0Mm })),
      coverage: f.coverage, equipment: f.equipment, placements: f.placements, pumpDefaults: f.pumpDefaults, pumps: f.pumps,
      infrastructure: f.infrastructure, dailyLimits: [], events: [], arbitration: null,
    }, module.reglages);

    for (const p of parcelles) {
      const r = resultats.get(p.id)!;
      const besoin = needs.find((n: any) => n.bedId === p.id);
      const issue = plan.beds.find((b: any) => b.bedId === p.id);
      r.semaines.push({
        lundi,
        objectif_mm: objectifs.get(p.id)!,
        besoin_mm: besoin?.effectiveNeedMm ?? 0,
        place_mm: issue?.placedMm ?? 0,
        non_place_mm: issue?.deficitMm ?? 0,
        raisons: issue?.reasons ?? [],
      });
    }
    for (const prop of plan.proposals) {
      for (const a of prop.bedApplications) {
        if (a.appliedMm > 0) resultats.get(a.bedId)!.arrosages.push({ debut: prop.startAt, fin: prop.endAt, mm: a.appliedMm, nature: 'banc-otf' });
      }
    }
  }
  return resultats;
}
