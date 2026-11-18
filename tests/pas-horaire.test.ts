// Tests du pas de calcul (MC-29). Lancer : node --test --experimental-strip-types tests/pas-horaire.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pasDuJour, apportsDesArrosages, bornesDuJour, fractionDuJour,
  JEU_OTF, JEU_TLALOC, type Apport, type EntreePas, type Reglages, type SortiePas,
} from '../src/pas-horaire.ts';
// @ts-expect-error : implémentation de référence en JavaScript, sans types
import * as REF from '../docs/ref-tlaloc/ref-tlaloc.mjs';

const TOL = 0.01; // mm, tolérance des cas de test (MC-30)
const lire = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const casT = Object.fromEntries(lire('../cas/cas-tlaloc.json').cas.map((c: any) => [c.id, c]));
const otf = lire('../cas/cas-otf.json');
const casO = Object.fromEntries([...otf.cas, ...otf.cas_limites].map((c: any) => [c.id, c]));

const proche = (obtenu: number | null, attendu: number, quoi: string) => {
  assert.ok(obtenu !== null, `${quoi} : inconnu`);
  assert.ok(Math.abs(obtenu - attendu) <= TOL, `${quoi} : ${obtenu} au lieu de ${attendu}`);
};
const connu = (s: SortiePas) => { if (!s.connu) throw new Error('inconnu : ' + s.raison); return s; };
const versApports = (l: { f: number; mm: number; type: string }[]): Apport[] =>
  l.map((a) => ({ f: a.f, mm: a.mm, type: a.type === 'irrigation' ? 'arrosage' : 'pluie' } as Apport));
const jour = (e: Partial<EntreePas>, r: Reglages) => connu(pasDuJour({ dr_veille: 0, etc: 0, ru: 60, plancher: null, apports: [], ...e }, r));

/* ---------- Cas Tlaloc (cas/cas-tlaloc.json) ---------- */

test('T01 journée sèche, horaire et journalier', () => {
  const e = casT.T01.entrees;
  for (const r of [JEU_TLALOC, JEU_OTF]) proche(jour({ dr_veille: e.Dr0, etc: e.etc, ru: e.taw }, r).dr, casT.T01.attendu.Dr, 'T01 ' + r.pas);
});

test('T02 arrosage du matin sur sol presque plein : horaire contre journalier', () => {
  const e = casT.T02.entrees, A = casT.T02.attendu;
  const base = { dr_veille: e.Dr0, etc: e.etc, ru: e.taw, apports: versApports(e.apports) };
  const h = jour(base, JEU_TLALOC), j = jour(base, JEU_OTF);
  proche(h.dr, A.Dr_horaire, 'Dr horaire'); proche(h.eau_perdue, A.perte_horaire, 'perte horaire');
  proche(j.dr, A.Dr_journalier, 'Dr journalier'); proche(j.eau_perdue, A.perte_journalier, 'perte journalier');
  proche(h.pic, 0, 'pic horaire (juste après l\'arrosage)');
  assert.equal(j.pic, null);
});

test('T03 la pluie draine sans compter en eau perdue', () => {
  const e = casT.T03.entrees, A = casT.T03.attendu;
  const h = jour({ dr_veille: e.Dr0, etc: e.etc, ru: e.taw, apports: versApports(e.apports) }, JEU_TLALOC);
  proche(h.dr, A.Dr, 'Dr'); proche(h.eau_perdue, A.perteIrrigation, 'eau perdue'); proche(h.drainage_pluie, A.drainagePluie, 'drainage de pluie');
});

test('T06 plancher : six jours secs puis 15 mm de pluie', () => {
  const e = casT.T06.entrees, A = casT.T06.attendu;
  let dT = e.Dr0, dO = e.Dr0;
  for (let k = 0; k < 6; k++) {
    dT = jour({ dr_veille: dT, etc: e.etc, ru: e.taw }, JEU_TLALOC).dr;
    dO = jour({ dr_veille: dO, etc: e.etc, ru: e.taw, plancher: e.plancher_OTF }, JEU_TLALOC).dr;
  }
  proche(dT, A.Dr_secTlaloc, 'sec sans plancher'); proche(dO, A.Dr_secOTF, 'sec avec plancher');
  const pluie: Apport[] = [{ type: 'pluie', f: 0.5, mm: 15 }];
  proche(jour({ dr_veille: dT, etc: 0, ru: e.taw, apports: pluie }, JEU_TLALOC).dr, A.Dr_apresPluieTlaloc, 'pluie sans plancher');
  proche(jour({ dr_veille: dO, etc: 0, ru: e.taw, plancher: e.plancher_OTF, apports: pluie }, JEU_TLALOC).dr, A.Dr_apresPluieOTF, 'pluie avec plancher');
  // Le même cas en journalier donne les mêmes chiffres (rien ne déborde).
  proche(jour({ dr_veille: dO, etc: 0, ru: e.taw, plancher: e.plancher_OTF, apports: pluie }, JEU_OTF).dr, A.Dr_apresPluieOTF, 'pluie avec plancher, journalier');
});

test('T12 journée sans débordement : horaire et journalier égaux', () => {
  const e = casT.T12.entrees, A = casT.T12.attendu;
  const apports: Apport[] = [{ type: 'arrosage', f: 0.25, mm: e.irrigation }, { type: 'pluie', f: 0.6, mm: e.pluie }];
  proche(jour({ dr_veille: e.Dr0, etc: e.etc, apports }, JEU_TLALOC).dr, A.Dr_horaire, 'horaire');
  proche(jour({ dr_veille: e.Dr0, etc: e.etc, apports }, JEU_OTF).dr, A.Dr_journalier, 'journalier');
});

/* ---------- Cas OTF du bilan journalier (cas/cas-otf.json), état = capacité − Dr ---------- */

test('O04 plancher, la remontée repart de 0', () => {
  const c = casO.O04.entrees, A = casO.O04.attendu, cap = c.capacite;
  const j1 = jour({ dr_veille: cap - c.jour1.etat_veille, etc: c.jour1.conso, ru: 60, plancher: cap }, JEU_OTF);
  proche(cap - j1.dr, A.etat_fin_jour1, 'état fin jour 1');
  const j2 = jour({ dr_veille: j1.dr, etc: c.jour2.conso, ru: 60, plancher: cap, apports: [{ type: 'pluie', f: 0, mm: c.jour2.pluie }] }, JEU_OTF);
  proche(cap - j2.dr, A.etat_fin_jour2, 'état fin jour 2');
});

test('O10 eau arrosée en trop au prorata', () => {
  const c = casO.O10.entrees;
  // drainage 6 mm avec 4 mm de pluie et 6 mm d'arrosage : manque de la veille 4 mm, consommation 0.
  const j = jour({ dr_veille: 4, etc: 0, ru: 60, apports: [{ type: 'pluie', f: 0, mm: c.pluie }, { type: 'arrosage', f: 0, mm: c.irrigation }] }, JEU_OTF);
  proche(j.drainage, c.drainage, 'drainage'); proche(j.eau_perdue, casO.O10.attendu.eau_perdue, 'eau perdue');
});

test('L4 arrosages proposé et planifié un jour prévu', () => {
  const c = casO.L4.entrees, A = casO.L4.attendu, cap = 15.3;
  const apports: Apport[] = c.arrosages.map((a: any) => ({ type: 'arrosage', f: 0.5, mm: a.mm }));
  const j = jour({ dr_veille: cap * (1 - c.observation_pct / 100), etc: c.etm, ru: 60, plancher: cap, apports }, JEU_OTF);
  proche(j.compte.arrosage, A.irrigation, 'arrosage compté'); proche(cap - j.dr, A.etat_fin, 'état fin'); proche(j.drainage, A.drainage, 'drainage');
});

test('L7 plancher atteint puis pluie', () => {
  const c = casO.L7.entrees, A = casO.L7.attendu, cap = 15.3;
  let dr = cap - c.jour0_etat;
  for (const [k, a] of [['jour1', 'jour1_etat'], ['jour2', 'jour2_etat'], ['jour3', 'jour3_etat']]) {
    dr = jour({ dr_veille: dr, etc: c[k].etm, ru: 60, plancher: cap, apports: [{ type: 'pluie', f: 0, mm: c[k].pluie }] }, JEU_OTF).dr;
    proche(cap - dr, A[a], k);
  }
});

/* ---------- Bassinage (MC-34) ---------- */

test('MC-34 bassinage court : 25 % dans le jeu Tlaloc, 100 % dans le jeu OTF', () => {
  const b: Apport = { type: 'bassinage', f: 0.5, mm: 2, duree_s: 300 };
  const t = jour({ dr_veille: 10, etc: 0, apports: [b] }, JEU_TLALOC);
  proche(t.dr, 9.5, 'Tlaloc'); proche(t.compte.arrosage, 0.5, 'compté Tlaloc');
  proche(jour({ dr_veille: 10, etc: 0, apports: [b] }, JEU_OTF).dr, 8, 'OTF');
  // Plus de 10 min : compté en entier ; durée inconnue : inconnu dans le jeu Tlaloc, sans effet dans le jeu OTF.
  proche(jour({ dr_veille: 10, etc: 0, apports: [{ ...b, duree_s: 601 }] }, JEU_TLALOC).dr, 8, 'bassinage long');
  const inc = pasDuJour({ dr_veille: 10, etc: 0, ru: 60, plancher: null, apports: [{ ...b, duree_s: null }] }, JEU_TLALOC);
  assert.equal(inc.connu, false); assert.equal(!inc.connu && inc.raison, 'duree_bassinage_inconnue');
  proche(jour({ dr_veille: 10, etc: 0, apports: [{ ...b, duree_s: null }] }, JEU_OTF).dr, 8, 'OTF, durée inconnue');
  // La part non comptée n'entre ni en drainage ni en eau perdue : 2 mm à 25 % sur un sol plein = 0,5 mm perdus.
  const plein = jour({ dr_veille: 0, etc: 0, apports: [b] }, JEU_TLALOC);
  proche(plein.eau_perdue, 0.5, 'eau perdue'); proche(plein.drainage, 0.5, 'drainage');
});

/* ---------- Inconnu, jamais zéro (MC-09) ---------- */

test('MC-09 une entrée inconnue rend le pas inconnu', () => {
  for (const r of [JEU_TLALOC, JEU_OTF]) {
    const base: EntreePas = { dr_veille: 5, etc: 3, ru: 60, plancher: null, apports: [] };
    assert.deepEqual(pasDuJour({ ...base, dr_veille: null }, r), { connu: false, mode: r.pas, dr: null, raison: 'dr_veille_inconnu' });
    assert.deepEqual(pasDuJour({ ...base, etc: null }, r), { connu: false, mode: r.pas, dr: null, raison: 'etc_inconnue' });
    assert.deepEqual(pasDuJour({ ...base, apports: [{ type: 'pluie', f: 0.5, mm: null }] }, r), { connu: false, mode: r.pas, dr: null, raison: 'apport_inconnu' });
  }
});

test('entrées hors bornes refusées', () => {
  const base: EntreePas = { dr_veille: 5, etc: 3, ru: 60, plancher: null, apports: [] };
  assert.throws(() => pasDuJour({ ...base, ru: 0 }, JEU_OTF), RangeError);
  assert.throws(() => pasDuJour({ ...base, etc: -1 }, JEU_OTF), RangeError);
  assert.throws(() => pasDuJour({ ...base, apports: [{ type: 'pluie', f: 1.2, mm: 1 }] }, JEU_OTF), RangeError);
  assert.throws(() => pasDuJour({ ...base, apports: [{ type: 'pluie', f: 0.5, mm: -1 }] }, JEU_OTF), RangeError);
});

/* ---------- Comparaisons sur des jours tirés au hasard ---------- */

function hasard(graine: number) { let s = graine >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

function jourAuHasard(r: () => number) {
  const ru = 20 + 80 * r(), plancher = r() < 0.5 ? null : ru * (0.4 + 0.6 * r());
  const n = Math.floor(r() * 5);
  const apports: { type: 'pluie' | 'arrosage'; f: number; mm: number }[] = [];
  for (let k = 0; k < n; k++) apports.push({ type: r() < 0.5 ? 'pluie' : 'arrosage', f: Math.round(r() * 24) / 24, mm: 30 * r() * r() });
  return { ru, plancher, dr_veille: ru * r(), etc: 8 * r(), apports };
}

test('journalier = la jauge d\'OTF (gauge.ts, computeDay) à 0,01 mm près, 20 000 jours', () => {
  const r = hasard(29);
  for (let k = 0; k < 20000; k++) {
    const e = jourAuHasard(r), cap = e.plancher ?? e.ru;
    // Transcription des lignes d'OTF (planche cultivée, sans observation) :
    // balance = start + inflow − consumed ; état = min(cap, max(0, balance)) ; drainage = max(0, balance − cap).
    const start = cap - Math.min(cap, e.dr_veille), inflow = e.apports.reduce((s, a) => s + a.mm, 0);
    const balance = start + inflow - e.etc, etat = Math.min(cap, Math.max(0, balance)), drain = Math.max(0, balance - cap);
    const s = jour({ ...e, dr_veille: Math.min(cap, e.dr_veille) }, JEU_OTF);
    assert.ok(Math.abs((cap - s.dr) - etat) <= TOL && Math.abs(s.drainage - drain) <= TOL, `jour ${k} : ${JSON.stringify(e)}`);
  }
});

test('horaire = l\'implémentation de référence de Tlaloc (ref-tlaloc.mjs) à 0,01 mm près, 20 000 jours', () => {
  const r = hasard(184);
  for (let k = 0; k < 20000; k++) {
    const e = jourAuHasard(r);
    const ref = REF.jourHoraire({ Dr0: e.dr_veille, etc: e.etc, taw: e.ru, plancher: e.plancher, apports: e.apports.map((a) => ({ ...a, type: a.type === 'arrosage' ? 'irrigation' : 'pluie' })) });
    const s = jour(e, JEU_TLALOC);
    assert.ok(Math.abs(s.dr - ref.Dr) <= TOL && Math.abs(s.eau_perdue - ref.perteIrrigation) <= TOL && Math.abs(s.drainage_pluie - ref.drainagePluie) <= TOL, `jour ${k}`);
  }
});

test('sans débordement dans la journée, horaire et journalier coïncident (T12 généralisé)', () => {
  const r = hasard(12);
  let vus = 0;
  for (let k = 0; k < 20000; k++) {
    const e = jourAuHasard(r);
    const h = jour(e, JEU_TLALOC);
    if (h.drainage > 0 || h.apres_apports.some((a) => a.dr === 0)) continue;
    // Pas de plafond touché non plus : le manque ne doit jamais atteindre Dmax dans la journée.
    const dmax = e.plancher === null ? e.ru : Math.min(e.ru, e.plancher);
    if (e.dr_veille + e.etc >= dmax) continue;
    vus++;
    assert.ok(Math.abs(h.dr - jour(e, JEU_OTF).dr) <= TOL, `jour ${k}`);
  }
  assert.ok(vus > 1000, `trop peu de jours comparés : ${vus}`);
});

/* ---------- Temps (contrat § 2) ---------- */

test('journées de 23, 24 et 25 h à Paris', () => {
  const h = (d: string) => { const b = bornesDuJour(d); return (b.fin - b.debut) / 36e5; };
  assert.equal(h('2026-03-29'), 23); assert.equal(h('2026-10-25'), 25); assert.equal(h('2026-07-14'), 24);
  assert.equal(new Date(bornesDuJour('2026-07-14').debut).toISOString(), '2026-07-13T22:00:00.000Z');
  assert.equal(new Date(bornesDuJour('2026-01-10').debut).toISOString(), '2026-01-09T23:00:00.000Z');
  // 6 h du matin le jour du passage à l'heure d'été : 5 h écoulées sur 23.
  proche(fractionDuJour('2026-03-29T06:00:00+02:00', '2026-03-29'), 5 / 23, 'fraction 29 mars');
  proche(fractionDuJour('2026-07-14T06:00:00+02:00', '2026-07-14'), 0.25, 'fraction 14 juillet');
});

test('arrosages : prorata à minuit, placé à son début, durée transmise', () => {
  const l = apportsDesArrosages([
    { debut: '2026-07-14T23:00:00+02:00', fin: '2026-07-15T01:00:00+02:00', mm: 10 },
    { debut: '2026-07-15T06:00:00+02:00', fin: '2026-07-15T06:05:00+02:00', mm: 2, type: 'bassinage' },
    { debut: '2026-07-15T18:00:00+02:00', fin: null, mm: 4 },
  ], '2026-07-15');
  assert.equal(l.length, 3);
  proche(l[0].f, 0, 'début de la part du jour'); proche(l[0].mm, 5, 'moitié après minuit');
  proche(l[1].f, 0.25, 'f du bassinage'); assert.equal(l[1].duree_s, 300); assert.equal(l[1].type, 'bassinage');
  proche(l[2].f, 0.75, 'f sans fin'); proche(l[2].mm, 4, 'mm sans fin');
  // La veille garde l'autre moitié.
  proche(apportsDesArrosages([{ debut: '2026-07-14T23:00:00+02:00', fin: '2026-07-15T01:00:00+02:00', mm: 10 }], '2026-07-14')[0].mm, 5, 'veille');
});

test('arrosages : même total qu\'OTF (irrigationBetween) sur une journée', () => {
  // Transcription d'OTF : chevauchement au prorata, ou tout l'apport si son début est dans le jour.
  const { debut, fin } = bornesDuJour('2026-10-25');
  const arr = [
    { debut: '2026-10-24T22:00:00+02:00', fin: '2026-10-25T04:00:00+01:00', mm: 12 },
    { debut: '2026-10-25T12:00:00+01:00', fin: '2026-10-25T12:00:00+01:00', mm: 3 },
    { debut: '2026-10-25T23:30:00+01:00', fin: '2026-10-26T00:30:00+01:00', mm: 2 },
  ];
  let attendu = 0;
  for (const a of arr) {
    const s = Date.parse(a.debut), e = Date.parse(a.fin);
    if (e <= s) { if (s >= debut && s < fin) attendu += a.mm; continue; }
    const o = Math.min(e, fin) - Math.max(s, debut); if (o > 0) attendu += a.mm * o / (e - s);
  }
  const total = apportsDesArrosages(arr, '2026-10-25').reduce((s, a) => s + (a.mm ?? 0), 0);
  proche(total, attendu, 'total du jour');
});
