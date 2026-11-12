// Calcule les sorties attendues des cas de test et écrit cas/cas-tlaloc.json (lancer : node docs/ref-tlaloc/cas.mjs)
import * as R from './ref-tlaloc.mjs';
import { writeFileSync } from 'fs';
const r2 = x => typeof x === 'number' ? Math.round(x * 100) / 100 : x;
const rnd = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r2(v)]));
const cas = [];
const add = (id, titre, decision, entrees, attendu, note) => cas.push({ id, titre, decision, entrees, attendu: rnd(attendu), note });

// T01 journée sèche
add('T01', 'Journée sèche, aucun apport', 'bilan', { Dr0: 5, etc: 4, taw: 60 },
  R.jourHoraire({ Dr0: 5, etc: 4, taw: 60 }), 'Dr = Dr0 + ETc. Même résultat en journalier.');
// T02 arrosage du matin sur sol presque plein, horaire contre journalier
{ const e = { Dr0: 2, etc: 4.8, taw: 60, apports: [{ f: 0.25, mm: 6, type: 'irrigation' }] };
  const h = R.jourHoraire(e), j = R.jourJournalier({ Dr0: 2, etc: 4.8, taw: 60, irrigation: 6 });
  add('T02', 'Arrosage de 6 mm à 6 h, sol à 2 mm de manque', 'pas de temps (MC-04)', e, { Dr_horaire: h.Dr, perte_horaire: h.perteIrrigation, Dr_journalier: j.Dr, perte_journalier: j.perteIrrigation },
    'À 6 h, le manque n\'est que de 2 + 1,2 = 3,2 mm : 2,8 mm partent sous les racines. En journalier, la consommation du jour compense : aucune perte. C\'est l\'écart le plus important entre les deux modes.'); }
// T03 pluie sur sol au manque de 10 mm
{ const e = { Dr0: 10, etc: 3, taw: 60, apports: [{ f: 15 / 24, mm: 20, type: 'pluie' }] }; const h = R.jourHoraire(e);
  add('T03', 'Pluie utile de 20 mm à 15 h, manque de 10 mm', 'eau perdue', e, { Dr: h.Dr, perteIrrigation: h.perteIrrigation, drainagePluie: h.drainagePluie }, 'L\'excès de pluie draine, mais n\'est jamais compté comme eau arrosée en trop.'); }
// T04 averse violente
{ const t = R.pluieUtileMesuree([2, 30, 3]), o = R.pluieUtileMesuree([2, 30, 3], { interception: 0, seuilRuiss: 1e9, partRuiss: 0 });
  add('T04', 'Averse : 2, 30 puis 3 mm en trois heures', 'pluie utile (MC-05)', { heures: [2, 30, 3] }, { Pe_jeuTlaloc: t.Pe, ruissellement_jeuTlaloc: t.ruissellement, Pe_jeuOTF: o.Pe }, 'Jeu Tlaloc : 50 % de ce qui dépasse 15 mm/h ruisselle, 2 mm interceptés. Jeu OTF : pluie brute.'); }
// T05 pluie prévue en désaccord, puis sûre
{ const a = R.pluieUtilePrevue(8, [8, 0, 3]), b = R.pluieUtilePrevue(8, [8, 6, 7]), o = R.pluieUtilePrevue(8, [8, 6, 7], { partPrevue: 1, interception: 0, regleSure: false });
  add('T05', 'Pluie prévue de 8 mm, modèles en désaccord puis d\'accord', 'pluie utile (MC-05)', { prevue: 8, modeles_desaccord: [8, 0, 3], modeles_accord: [8, 6, 7] }, { Pe_desaccord_Tlaloc: a.Pe, Pe_sure_Tlaloc: b.Pe, Pe_OTF: o.Pe }, 'Jeu Tlaloc : 50 % − 2 mm, ou 80 % du plus faible − 1 mm si tous les modèles annoncent au moins 1 mm. Jeu OTF : R2 = 100 %.'); }
// T06 plancher
{ let dT = 30, dO = 30; for (let k = 0; k < 6; k++) { dT = R.jourHoraire({ Dr0: dT, etc: 5, taw: 48 }).Dr; dO = R.jourHoraire({ Dr0: dO, etc: 5, taw: 48, plancher: 32 }).Dr; }
  const pT = R.jourHoraire({ Dr0: dT, etc: 0, taw: 48, apports: [{ f: 0.5, mm: 15, type: 'pluie' }] }).Dr, pO = R.jourHoraire({ Dr0: dO, etc: 0, taw: 48, plancher: 32, apports: [{ f: 0.5, mm: 15, type: 'pluie' }] }).Dr;
  add('T06', '6 jours secs (ETc 5 mm), puis 15 mm de pluie ; RU 48 mm, RFU de labo 32 mm', 'plancher (MC-02)', { Dr0: 30, etc: 5, taw: 48, plancher_OTF: 32 }, { Dr_secTlaloc: dT, Dr_secOTF: dO, Dr_apresPluieTlaloc: pT, Dr_apresPluieOTF: pO },
    'Sans plancher (Tlaloc), le déficit au-delà de la RFU de labo est gardé : après la pluie, il manque encore 33 mm. Avec plancher (OTF), la jauge est remontée à 17 mm.'); }
// T07 p ajusté
add('T07', 'Part facile p ajustée à la chaleur', 'p (à trancher)', { pTab: 0.4, etc: [2, 5, 7, 12] }, { p_etc2: R.pAjuste(0.4, 2), p_etc5: R.pAjuste(0.4, 5), p_etc7: R.pAjuste(0.4, 7), p_etc12: R.pAjuste(0.4, 12) }, 'Option ; désactivée, p reste celui du tableau (jeu OTF).');
// T08 poing en fourchette, une prise
{ const sdU = R.sdAuRelevé(0.35 * 60, 0, 60), c = R.poingFourchette(40, 15, ['correct']), d = R.poingFourchette(60, 15, ['correct']);
  add('T08', 'Test du poing « Correct » (50–75 % de RU)', 'observation poing (option)', { calcul_RU: [40, 60], incertitude_RU: 15, erreurLecture: 8 }, { mu_si_calcul40: c.mu, sd_si_calcul40: c.sd, mu_si_calcul60: d.mu, sd_si_calcul60: d.sd },
    'Si le calcul est déjà dans la classe (60 %), il bouge peu ; s\'il est dehors (40 %), il est ramené vers elle sans sauter au centre (62,5 %).'); }
// T09 trois prises groupées
{ const g = R.poingFourchette(40, 15, ['correct', 'correct', 'sec']);
  add('T09', 'Trois prises notées dans l\'heure : Correct, Correct, Sec', 'observation poing (option)', { calcul_RU: 40, incertitude_RU: 15 }, { mu: g.mu, sd: g.sd }, 'Les prises à moins de 60 min d\'écart comptent ensemble : la vraisemblance est le produit des trois.'); }
// T10 consommation apprise
{ const taw = 60, DrAvant = (1 - 40 / 100) * taw, f = R.poingFourchette(40, 15, ['correct']), DrApres = (1 - f.mu / 100) * taw;
  const kf = R.kfApres(1, { DrAvant, DrApres, consoDepuisAncrage: 20, sdAvant: 15, sdApres: f.sd });
  add('T10', 'Consommation apprise après le relevé de T08 (calcul à 40 %)', 'consommation apprise (option)', { taw, DrAvant, DrApres, consoDepuisAncrage: 20, kf0: 1 }, { kf },
    'Le relevé dit plus humide que le calcul : la consommation est revue à la baisse, d\'une part du décalage (0,3 × ce que le relevé apprend), bornée à ± 15 % par relevé, de 0,6 à 1,6 au total.'); }
// T11 tensiomètre
add('T11', 'Tensiomètre à 30 kPa, seuils 10 et 60 kPa, RAW 20 mm', 'observation tensiomètre', { T: 30, bas: 10, haut: 60, raw: 20 }, { Dr: R.tensioVersDr(30, 10, 60, 20), Dr_5kPa: R.tensioVersDr(5, 10, 60, 20), Dr_80kPa: R.tensioVersDr(80, 10, 60, 20) },
  'Correspondance linéaire de Tlaloc, à caler sur les relevés (Watermark) : point ouvert.');
// T12 journalier identique à l'horaire quand rien ne déborde
{ const h = R.jourHoraire({ Dr0: 20, etc: 4, taw: 60, apports: [{ f: 0.25, mm: 5, type: 'irrigation' }, { f: 0.6, mm: 3, type: 'pluie' }] }), j = R.jourJournalier({ Dr0: 20, etc: 4, taw: 60, irrigation: 5, pluie: 3 });
  add('T12', 'Journée sans débordement : horaire et journalier égaux', 'pas de temps (MC-04)', { Dr0: 20, etc: 4, irrigation: 5, pluie: 3 }, { Dr_horaire: h.Dr, Dr_journalier: j.Dr },
    'Condition pour « résultats identiques » : aucun apport n\'arrive sur un sol plein dans la journée. Sinon, le contrat doit dire lequel des deux fait foi pour le jeu OTF (proposition : le journalier, ordre « tout le jour en une fois »).'); }
writeFileSync(new URL('../../cas/cas-tlaloc.json', import.meta.url), JSON.stringify({ version: '0.1.1', date: '2026-11-08', source: 'Tlaloc v184, implémentation de référence ref-tlaloc.mjs', cas }, null, 1));
for (const c of cas) console.log(c.id, c.titre, JSON.stringify(c.attendu));
