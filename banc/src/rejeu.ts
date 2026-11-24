/**
 * Le rejeu d'une année (contrat du banc, § 2, § 7 bis, § 7 ter), passe 1 :
 * pour chaque parcelle de la démo, les arrosages de chaque côté (OTF : rejoués
 * par la logique du module ; Tlaloc : son plan tel quel), jugés par le moteur
 * commun avec les deux jeux, puis les indicateurs par parcelle et pour la ferme.
 */
import { JEU_OTF, JEU_TLALOC, type ArrosageDuJour, type JeuDeReglages } from '../../src/moteur.ts';
import { auCentieme } from './classement.ts';
import { fenetreMeteo } from './dates.ts';
import { etmSerie } from './etm.ts';
import type { ParcelleBanc } from './export-demo.ts';
import { indicateurs, indicateursFerme, type ApportPlan, type Cote, type IndicateursFerme, type IndicateursParcelle } from './indicateurs.ts';
import { juger, type HeurePluie } from './juge.ts';
import type { TableKc } from './kc.ts';
import type { JourMeteo } from './meteo.ts';
import { rejouerOtf, type MaterielOtf, type ModuleOtf } from './cote-otf.ts';
import type { LignePlan } from './plan-tlaloc.ts';
import type { TableSol } from './sol.ts';

const FUSEAU = 'Europe/Paris';
const JUGES: readonly { cle: Juge; jeu: JeuDeReglages }[] = [{ cle: 'juge_otf', jeu: JEU_OTF }, { cle: 'juge_tlaloc', jeu: JEU_TLALOC }];
export type Juge = 'juge_otf' | 'juge_tlaloc';

/**
 * Heures des arrosages du plan de Tlaloc, qui ne donne qu'un total par jour :
 * l'arrosage du jour à `arrosage` (heure de Paris, « HH:MM »), les bassinages à
 * `bassinage.heure`, chacun d'une durée de `bassinage.duree_s`. À confirmer
 * par Nicolas (§ 10) ; seul le juge horaire en dépend.
 */
export type HeuresPlanTlaloc = { arrosage: string; bassinage: { heure: string; duree_s: number } };

/** L'instant UTC d'une heure de Paris un jour donné. */
export function instantParis(date: string, heure: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(heure);
  if (!m) throw new Error(`heure illisible « ${heure} »`);
  const voulu = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +m[1], +m[2]);
  // Le décalage de Paris à cet instant (une ou deux heures), lu par Intl.
  const lire = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(t)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t;
  };
  let t = voulu - lire(voulu);
  t = voulu - lire(t);
  return new Date(t).toISOString();
}

/** Les arrosages du plan de Tlaloc pour une parcelle, et ses apports pour les indicateurs. */
export function arrosagesTlaloc(lignes: readonly LignePlan[], parcelle: string, heures: HeuresPlanTlaloc): { arrosages: ArrosageDuJour[]; apports: ApportPlan[] } {
  const arrosages: ArrosageDuJour[] = [];
  const apports: ApportPlan[] = [];
  for (const l of lignes) {
    if (l.parcelle !== parcelle) continue;
    const eau = auCentieme(l.mm - l.mm_bassinage);
    if (eau > 0) {
      const debut = instantParis(l.date, heures.arrosage);
      arrosages.push({ debut, fin: null, mm: eau, type: 'arrosage', nature: 'banc-tlaloc' });
      apports.push({ date: l.date, mm: eau, bassinage: false });
    }
    if (l.mm_bassinage > 0) {
      const debut = instantParis(l.date, heures.bassinage.heure);
      const fin = new Date(Date.parse(debut) + heures.bassinage.duree_s * 1000).toISOString();
      arrosages.push({ debut, fin, mm: l.mm_bassinage, type: 'bassinage', nature: 'banc-tlaloc' });
      apports.push({ date: l.date, mm: l.mm_bassinage, bassinage: true });
    }
  }
  return { arrosages, apports };
}

/** Le jour de Paris d'un instant. */
function jourParis(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}

export type EntreeRejeu = {
  annee: number;
  parcelles: readonly ParcelleBanc[];
  planTlaloc: readonly LignePlan[];
  meteo: readonly JourMeteo[];
  heures: ReadonlyMap<string, readonly HeurePluie[] | null>;
  tableKc: TableKc;
  tableSol: TableSol;
  materiels: ReadonlyMap<string, MaterielOtf>;
  heuresTlaloc: HeuresPlanTlaloc;
  module: ModuleOtf;
};

export type CoteRejoue = Record<Juge, IndicateursParcelle> & { eau_non_placee_mm: number | null };
export type ParcelleRejouee = { id: string; serre: boolean; surface_m2: number; otf: CoteRejoue; tlaloc: CoteRejoue };
export type RapportAnnee = {
  annee: number;
  module_otf_commit: string | null;
  parcelles: ParcelleRejouee[];
  ferme: Record<Cote, Record<Juge, IndicateursFerme>>;
};

export function rejouerAnnee(e: EntreeRejeu): RapportAnnee {
  const { debut } = fenetreMeteo(e.annee);
  const finPlans = fenetreMeteo(e.annee).fin;
  const et0 = new Map(e.meteo.map((m) => [m.date, m.et0_mm]));
  const avecPlan = new Set(e.planTlaloc.map((l) => l.parcelle));
  for (const p of e.parcelles) {
    if (!e.materiels.has(p.id)) throw new Error(`${p.id} : matériel d'OTF inconnu`);
    if (!avecPlan.has(p.id)) throw new Error(`${p.id} : absente du plan de Tlaloc`);
  }

  // Côté OTF : toute la ferme planifiée ensemble, semaine après semaine, jusqu'à la semaine du 31 décembre.
  // L'objectif proposé d'OTF compte 0 un jour sans culture (D-045, `bedWaterDay` « no-crop ») : le sol nu n'est pas arrosé.
  const etm = new Map(e.parcelles.map((p) => [p.id, new Map(etmSerie(p.cultures, p.serre, et0, debut, finPlans, e.tableKc)
    .map((j) => [j.date, j.cultures.length === 0 ? 0 : j.etm_mm]))]));
  const otf = rejouerOtf(
    e.module,
    e.parcelles.map((p) => ({ id: p.id, serre: p.serre, surface_m2: p.surface_m2, materiel: e.materiels.get(p.id)! })),
    etm, e.meteo, debut, `${e.annee}-12-31`, e.annee,
  );

  const parcelles: ParcelleRejouee[] = e.parcelles.map((p) => {
    const o = otf.get(p.id)!;
    const t = arrosagesTlaloc(e.planTlaloc, p.id, e.heuresTlaloc);
    const cotes = {
      otf: { arrosages: o.arrosages, apports: o.arrosages.map((a) => ({ date: jourParis(a.debut), mm: a.mm!, bassinage: false })) },
      tlaloc: t,
    };
    const juge = (cote: Cote) => Object.fromEntries(JUGES.map(({ cle, jeu }) => [cle, indicateurs(juger({
      annee: e.annee, serre: p.serre, cultures: p.cultures, meteo: e.meteo, heures: e.heures,
      arrosages: cotes[cote].arrosages, tableKc: e.tableKc, tableSol: e.tableSol,
    }, jeu), cotes[cote].apports, cote)])) as Record<Juge, IndicateursParcelle>;
    // Eau non placée d'OTF : les semaines dont le lundi est dans l'année. Celle de Tlaloc n'est pas dans son plan (§ 10).
    const nonPlace = auCentieme(o.semaines.filter((s) => s.lundi.startsWith(`${e.annee}-`)).reduce((s, x) => s + x.non_place_mm, 0));
    return { id: p.id, serre: p.serre, surface_m2: p.surface_m2, otf: { ...juge('otf'), eau_non_placee_mm: nonPlace }, tlaloc: { ...juge('tlaloc'), eau_non_placee_mm: null } };
  });

  const ferme = (cote: Cote) => Object.fromEntries(JUGES.map(({ cle }) => [cle, indicateursFerme(parcelles.map((p) => ({ surface_m2: p.surface_m2, ind: p[cote][cle] })))])) as Record<Juge, IndicateursFerme>;
  return { annee: e.annee, module_otf_commit: e.module.commit, parcelles, ferme: { otf: ferme('otf'), tlaloc: ferme('tlaloc') } };
}

/** Tolérance du § 7 : 1 % de l'eau totale de la saison (moyenne des deux côtés). */
const TOLERANCE_EAU = 0.01;

const nombre = (x: number) => x.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Le rapport d'une année, en Markdown : la ferme pour chaque juge, puis l'eau parcelle par parcelle. */
export function rapportAnnee(r: RapportAnnee): string {
  const l: string[] = [`# Banc d'essai, passe 1 : ${r.annee}`, '', `Module OTF au commit \`${r.module_otf_commit ?? 'inconnu'}\`. Contrat : \`docs/contrat-banc-essai.md\`, § 7 bis et § 7 ter. Aucun gagnant n'est désigné (D-065).`, ''];
  for (const { cle, jeu } of JUGES) {
    const o = r.ferme.otf[cle];
    const t = r.ferme.tlaloc[cle];
    l.push(`## Ferme, juge ${jeu.nom}`, '', `Surface : ${nombre(o.surface_m2)} m² ; mm pondérés par la surface, jours en moyenne pondérée (parcelles touchées).`, '', '| Indicateur | OTF | Tlaloc |', '|---|---|---|');
    const mm: [string, keyof IndicateursFerme['mm']][] = [
      ['Eau apportée (mm)', 'eau_apportee_mm'], ['Eau apportée sans bassinage (mm)', 'eau_apportee_sans_bassinage_mm'], ['Eau perdue (mm)', 'eau_perdue_mm'],
      ['Écart au besoin, somme (mm)', 'ecart_besoin_somme_mm'], ['Écart au besoin, valeurs absolues (mm)', 'ecart_besoin_absolu_mm'],
    ];
    for (const [nom, k] of mm) l.push(`| ${nom} | ${nombre(o.mm[k])} | ${nombre(t.mm[k])} |`);
    const jours: [string, keyof IndicateursFerme['jours']][] = [
      ['Jours sous le seuil propre', 'jours_seuil_propre'], ['Jours sous le seuil commun (Dr > 0,5 × RAW)', 'jours_seuil_commun'],
      ['Jours en stress (Dr > RAW)', 'jours_stress'], ['Jours à réserve vide (Dr ≥ RU)', 'jours_reserve_vide'],
    ];
    for (const [nom, k] of jours) l.push(`| ${nom} | ${nombre(o.jours[k].moyenne)} (${o.jours[k].parcelles}) | ${nombre(t.jours[k].moyenne)} (${t.jours[k].parcelles}) |`);
    l.push(`| Nombre d'arrosages | ${o.nombre_arrosages} | ${t.nombre_arrosages} |`);
    const ecart = Math.abs(o.mm.eau_apportee_mm - t.mm.eau_apportee_mm);
    const base = (o.mm.eau_apportee_mm + t.mm.eau_apportee_mm) / 2;
    l.push('', ecart <= TOLERANCE_EAU * base
      ? `Eau apportée : **d'accord** (écart de ${nombre(ecart)} mm, sous 1 % de l'eau de la saison).`
      : `Eau apportée : **écart** de ${nombre(ecart)} mm (au-delà de 1 % de l'eau de la saison) ; voir les parcelles.`, '');
  }
  l.push('## Parcelles (juge OTF)', '', '| Parcelle | Surface (m²) | Serre | Eau OTF (mm) | Eau Tlaloc (mm) | Perdue OTF | Perdue Tlaloc | Stress OTF (j) | Stress Tlaloc (j) | Non placée OTF |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const p of r.parcelles) {
    const o = p.otf.juge_otf;
    const t = p.tlaloc.juge_otf;
    l.push(`| ${p.id} | ${nombre(p.surface_m2)} | ${p.serre ? 'oui' : 'non'} | ${nombre(o.eau_apportee_mm)} | ${nombre(t.eau_apportee_mm)} | ${nombre(o.eau_perdue_mm)} | ${nombre(t.eau_perdue_mm)} | ${o.jours_stress} | ${t.jours_stress} | ${nombre(p.otf.eau_non_placee_mm ?? 0)} |`);
  }
  l.push('', 'Jours sans culture et jours à état inconnu : hors des comptes de jours, publiés dans le JSON. Stabilité : 0 côté OTF en passe 1 par construction (§ 7 ter) ; côté Tlaloc, elle demande l\'historique de ses plans (passe 2).', '', 'p du juge : ceux d\'OTF (FAO-56). Deux écarts avec Tlaloc, tranchés par François le 24/11 : mâche 0,20 (Tlaloc 0,30), melon 0,40 (Tlaloc 0,45).', '');
  return l.join('\n');
}
