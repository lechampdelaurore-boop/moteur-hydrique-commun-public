/**
 * Le rejeu d'une année (contrat du banc, § 2, § 7 bis, § 7 ter), passe 1 :
 * pour chaque parcelle de la démo, les arrosages de chaque côté (OTF : rejoués
 * par la logique du module ; Tlaloc : son plan tel quel), jugés par le moteur
 * commun avec les deux jeux, puis les indicateurs par parcelle et pour la ferme.
 */
import { JEU_OTF, JEU_TLALOC, type ArrosageDuJour, type JeuDeReglages } from '../../src/moteur.ts';
import { auCentieme } from './classement.ts';
import { fenetreMeteo, jourSuivant } from './dates.ts';
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

/** Les arrosages du plan de Tlaloc pour une parcelle (ce qui arrive au sol), et ses apports pour les indicateurs (toute l'eau sortie du tuyau). */
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
      // Au sol : la part que Tlaloc compte (`mm_sol`, moins l'eau d'arrosage qui y va tout entière) ; « eau apportée » garde `mm_bassinage`
      // en entier, c'est de l'eau sortie du tuyau (Nicolas, 28/11).
      const auSol = auCentieme(Math.max(0, l.mm_sol - eau));
      if (auSol > 0) {
        const debut = instantParis(l.date, heures.bassinage.heure);
        const fin = new Date(Date.parse(debut) + heures.bassinage.duree_s * 1000).toISOString();
        arrosages.push({ debut, fin, mm: auSol, type: 'bassinage', nature: 'banc-tlaloc' });
      }
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
  /** Parcelles dont le sol du juge est publié jour par jour (RU, RAW, manque, eau) dans le JSON du rapport. */
  detail?: readonly string[];
};

const centieme = (x: number | null) => (x === null ? null : auCentieme(x));

/** Le sol du juge un jour donné : de quoi comparer avec ce que Tlaloc compte de son côté (Nicolas, 28/11). */
export type JourDetail = {
  date: string;
  /** Profondeur des racines retenue (m) : RU ÷ eau utile de la texture. */
  zr_m: number | null;
  ru_mm: number | null;
  raw_mm: number | null;
  p: number | null;
  dr_mm: number | null;
  arrosage_mm: number;
  eau_perdue_mm: number | null;
  /** La culture qui décide du sol ; null : aucune culture en place. */
  decisive: string | null;
};

export type CoteRejoue = Record<Juge, IndicateursParcelle> & { eau_non_placee_mm: number | null };
export type ParcelleRejouee = { id: string; serre: boolean; surface_m2: number; sans_debit: boolean; otf: CoteRejoue; tlaloc: CoteRejoue };
export type RapportAnnee = {
  annee: number;
  module_otf_commit: string | null;
  parcelles: ParcelleRejouee[];
  /** Parcelles sorties des indicateurs de la ferme (sans débit chez Tlaloc), rapportées à part. */
  hors_comparaison: string[];
  /** Pour les parcelles demandées (`detail`) : le sol du juge jour par jour, pour chaque côté et chaque juge. */
  detail?: Record<string, Record<Cote, Record<Juge, JourDetail[]>>>;
  ferme: Record<Cote, Record<Juge, IndicateursFerme>>;
};

/**
 * Le rattrapage du lundi (§ 7 ter, décidé par François le 28/11) : le manque au-delà du
 * seuil propre de Tlaloc, Dr − 0,5 × RAW, lu au soir de la veille par le juge Tlaloc
 * sur les arrosages d'OTF déjà faits ; 0 si la réserve facile est connue et pas entamée
 * au-delà de la moitié, ou si aucune culture n'est en place (RAW inconnue).
 */
export function rattrapageDuLundi(e: EntreeRejeu, parcelle: string, lundi: string, arrosagesFaits: readonly ArrosageDuJour[]): number {
  const p = e.parcelles.find((x) => x.id === parcelle);
  if (!p) throw new Error(`${parcelle} : parcelle inconnue`);
  const veille = jourSuivant(lundi, -1);
  const jours = juger({
    annee: e.annee, serre: p.serre, cultures: p.cultures, meteo: e.meteo, heures: e.heures,
    arrosages: arrosagesFaits, tableKc: e.tableKc, tableSol: e.tableSol,
  }, JEU_TLALOC);
  const j = jours.find((x) => x.date === veille);
  if (!j || !j.raw_connue || j.dr_mm === null || j.raw_mm === null) return 0;
  return auCentieme(Math.max(0, j.dr_mm - 0.5 * j.raw_mm));
}

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
    (parcelle, lundi, arrosagesFaits) => rattrapageDuLundi(e, parcelle, lundi, arrosagesFaits),
  );

  const detailParcelles: NonNullable<RapportAnnee['detail']> = {};
  const parcelles: ParcelleRejouee[] = e.parcelles.map((p) => {
    const o = otf.get(p.id)!;
    const t = arrosagesTlaloc(e.planTlaloc, p.id, e.heuresTlaloc);
    const cotes = {
      otf: { arrosages: o.arrosages, apports: o.arrosages.map((a) => ({ date: jourParis(a.debut), mm: a.mm!, bassinage: false })) },
      tlaloc: t,
    };
    const detail: Record<Cote, Record<Juge, JourDetail[]>> | null = e.detail?.includes(p.id) ? { otf: {} as Record<Juge, JourDetail[]>, tlaloc: {} as Record<Juge, JourDetail[]> } : null;
    if (detail) detailParcelles[p.id] = detail;
    const juge = (cote: Cote) => Object.fromEntries(JUGES.map(({ cle, jeu }) => {
      const jours = juger({
        annee: e.annee, serre: p.serre, cultures: p.cultures, meteo: e.meteo, heures: e.heures,
        arrosages: cotes[cote].arrosages, tableKc: e.tableKc, tableSol: e.tableSol,
      }, jeu);
      if (detail) {
        detail[cote][cle] = jours.filter((j) => j.compte).map((j) => ({
          date: j.date, zr_m: j.ru_mm === null ? null : auCentieme(j.ru_mm / e.tableSol.theta_u_mm_m), ru_mm: centieme(j.ru_mm), raw_mm: centieme(j.raw_mm), p: j.p === null ? null : Math.round(j.p * 1000) / 1000,
          dr_mm: centieme(j.dr_mm), arrosage_mm: auCentieme(j.arrosage_mm), eau_perdue_mm: centieme(j.eau_perdue_mm), decisive: j.decisive,
        }));
      }
      return [cle, indicateurs(jours, cotes[cote].apports, cote)];
    })) as Record<Juge, IndicateursParcelle>;
    // Eau non placée d'OTF : les semaines dont le lundi est dans l'année. Celle de Tlaloc n'est pas dans son plan (§ 10).
    const nonPlace = auCentieme(o.semaines.filter((s) => s.lundi.startsWith(`${e.annee}-`)).reduce((s, x) => s + x.non_place_mm, 0));
    return { id: p.id, serre: p.serre, surface_m2: p.surface_m2, sans_debit: p.sans_debit, otf: { ...juge('otf'), eau_non_placee_mm: nonPlace }, tlaloc: { ...juge('tlaloc'), eau_non_placee_mm: null } };
  });

  const ferme = (cote: Cote) => Object.fromEntries(JUGES.map(({ cle }) => [cle, indicateursFerme(parcelles.filter((p) => !p.sans_debit).map((p) => ({ surface_m2: p.surface_m2, ind: p[cote][cle] })))])) as Record<Juge, IndicateursFerme>;
  return { annee: e.annee, module_otf_commit: e.module.commit, parcelles, hors_comparaison: parcelles.filter((p) => p.sans_debit).map((p) => p.id), ...(e.detail ? { detail: detailParcelles } : {}), ferme: { otf: ferme('otf'), tlaloc: ferme('tlaloc') } };
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
  if (r.hors_comparaison.length > 0) {
    l.push(`Hors des comparaisons de la ferme (sans débit de vanne chez Tlaloc, d'accord avec Nicolas sur la PR n° 19) : ${r.hors_comparaison.join(', ')}. Leur eau est rapportée à part, dans le tableau des parcelles.`, '');
  }
  l.push('## Parcelles (juge OTF)', '', '| Parcelle | Surface (m²) | Serre | Eau OTF (mm) | Eau Tlaloc (mm) | Perdue OTF | Perdue Tlaloc | Stress OTF (j) | Stress Tlaloc (j) | Non placée OTF |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const p of r.parcelles) {
    const o = p.otf.juge_otf;
    const t = p.tlaloc.juge_otf;
    l.push(`| ${p.id}${p.sans_debit ? ' (hors comparaison)' : ''} | ${nombre(p.surface_m2)} | ${p.serre ? 'oui' : 'non'} | ${nombre(o.eau_apportee_mm)} | ${nombre(t.eau_apportee_mm)} | ${nombre(o.eau_perdue_mm)} | ${nombre(t.eau_perdue_mm)} | ${o.jours_stress} | ${t.jours_stress} | ${nombre(p.otf.eau_non_placee_mm ?? 0)} |`);
  }
  l.push('', 'Les bassinages de Tlaloc entrent au sol pour la part que son plan compte (`mm_sol`) ; « eau apportée » les garde en entier.', '', 'Côté OTF, l\'objectif du lundi est l\'ETM de la semaine plus le rattrapage du manque du lundi au-delà de 0,5 × RAW (§ 7 ter, décidé par François le 28/11) : le manque est lu au soir de la veille par le juge Tlaloc sur les arrosages d\'OTF déjà faits. Les jours de stress qui restent viennent de cette règle hebdomadaire (un seul calcul le lundi) et de l\'eau non placée, pas du module lui-même.', '', 'Sous abri, le juge démarre le 1er janvier à Dr = ½ × RAW de chaque juge (comme Tlaloc, qui part d\'une serre au seuil d\'arrosage) ; en plein champ, il démarre le 15 octobre d\'avant.', '', 'Eau perdue de Tlaloc sous serre l\'été : ses plans apportent jusqu\'à 17-18 mm certains jours (un fond, puis deux compléments) alors que le manque de la veille n\'est que de 1 à 8 mm : c\'est une conduite du plan, pas un écart de calcul.', '', 'Jours sans culture et jours à état inconnu : hors des comptes de jours, publiés dans le JSON. Stabilité : 0 côté OTF en passe 1 par construction (§ 7 ter) ; côté Tlaloc, elle demande l\'historique de ses plans (passe 2).', '', 'p du juge : ceux d\'OTF (FAO-56). Deux écarts avec Tlaloc, tranchés par François le 24/11 : mâche 0,20 (Tlaloc 0,30), melon 0,40 (Tlaloc 0,45).', '');
  return l.join('\n');
}
