/* Moteur hydrique commun (OTF et Tlaloc) v0.2.0. Licence PolyForm Shield 1.0.0 (LICENSE, NOTICE).
   Fichier construit depuis src/moteur.ts par scripts/construire.mjs : ne pas le modifier à la main. */
"use strict";
var MoteurHydrique = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/moteur.ts
  var moteur_exports = {};
  __export(moteur_exports, {
    CENTRE_CLASSE: () => CENTRE_CLASSE,
    CLASSES_POING: () => CLASSES_POING,
    CONSOMMATION_APPRISE: () => CONSOMMATION_APPRISE,
    FUSEAU: () => FUSEAU,
    INCERTITUDE: () => INCERTITUDE,
    JEU_OTF: () => JEU_OTF2,
    JEU_TLALOC: () => JEU_TLALOC2,
    VERSION_MOTEUR: () => VERSION_MOTEUR,
    apportsDesArrosages: () => apportsDesArrosages,
    bornesDuJour: () => bornesDuJour,
    conserver: () => conserver,
    enPoints: () => enPoints,
    etatEnPoints: () => etatEnPoints,
    fractionDuJour: () => fractionDuJour,
    incertitudeMm: () => incertitudeMm,
    kfApres: () => kfApres,
    manqueDepuisPoints: () => manqueDepuisPoints,
    pAjuste: () => pAjuste,
    pasDuJour: () => pasDuJour,
    pluieUtile: () => pluieUtile,
    pluieUtileDuJour: () => pluieUtileDuJour,
    pluieUtileMesuree: () => pluieUtileMesuree,
    pluieUtilePrevue: () => pluieUtilePrevue,
    poingFourchette: () => poingFourchette,
    suivre: () => suivre,
    tensioVersDr: () => tensioVersDr,
    verifierJeu: () => verifierJeu
  });

  // src/pas-horaire.ts
  var JEU_OTF = Object.freeze({
    pas: "journalier",
    bassinage: Object.freeze({ duree_max_s: 600, part_comptee: 1 })
  });
  var JEU_TLALOC = Object.freeze({
    pas: "horaire",
    bassinage: Object.freeze({ duree_max_s: 600, part_comptee: 0.25 })
  });
  var estNombre = (x) => typeof x === "number" && Number.isFinite(x);
  function verifier(entree, reglages) {
    if (reglages.pas !== "horaire" && reglages.pas !== "journalier") throw new RangeError("pas : horaire ou journalier");
    const b = reglages.bassinage;
    if (!estNombre(b.duree_max_s) || b.duree_max_s < 0) throw new RangeError("bassinage.duree_max_s doit être ≥ 0");
    if (!estNombre(b.part_comptee) || b.part_comptee < 0 || b.part_comptee > 1) throw new RangeError("bassinage.part_comptee entre 0 et 1");
    if (!estNombre(entree.ru) || entree.ru <= 0) throw new RangeError("ru doit être > 0 mm");
    if (entree.plancher !== null && (!estNombre(entree.plancher) || entree.plancher <= 0)) throw new RangeError("plancher : null ou > 0 mm");
    if (entree.dr_veille !== null && (!estNombre(entree.dr_veille) || entree.dr_veille < 0)) throw new RangeError("dr_veille : null ou ≥ 0 mm");
    if (entree.etc !== null && (!estNombre(entree.etc) || entree.etc < 0)) throw new RangeError("etc : null ou ≥ 0 mm");
    for (const a of entree.apports) {
      if (a.type !== "pluie" && a.type !== "arrosage" && a.type !== "bassinage") throw new RangeError("type d'apport inconnu");
      if (!estNombre(a.f) || a.f < 0 || a.f > 1) throw new RangeError("f doit être entre 0 et 1");
      if (a.mm !== null && (!estNombre(a.mm) || a.mm < 0)) throw new RangeError("mm : null ou ≥ 0");
      if (a.duree_s != null && (!estNombre(a.duree_s) || a.duree_s < 0)) throw new RangeError("duree_s : null ou ≥ 0");
    }
  }
  function mmCompte(a, reglages) {
    if (a.mm === null) return { raison: "apport_inconnu" };
    if (a.type !== "bassinage") return { mm: a.mm };
    const { duree_max_s, part_comptee } = reglages.bassinage;
    if (part_comptee === 1) return { mm: a.mm };
    if (a.duree_s == null) return { raison: "duree_bassinage_inconnue" };
    return { mm: a.duree_s <= duree_max_s ? a.mm * part_comptee : a.mm };
  }
  function pasDuJour(entree, reglages) {
    verifier(entree, reglages);
    const mode = reglages.pas;
    if (entree.dr_veille === null) return { connu: false, mode, dr: null, raison: "dr_veille_inconnu" };
    if (entree.etc === null) return { connu: false, mode, dr: null, raison: "etc_inconnue" };
    const apports = [];
    for (const a of entree.apports) {
      const c = mmCompte(a, reglages);
      if ("raison" in c) return { connu: false, mode, dr: null, raison: c.raison };
      apports.push({ f: a.f, type: a.type, mm: c.mm });
    }
    apports.sort((x, y) => x.f - y.f);
    const dmax = entree.plancher === null ? entree.ru : Math.min(entree.ru, entree.plancher);
    const etc = entree.etc;
    const pluie = apports.filter((a) => a.type === "pluie").reduce((s, a) => s + a.mm, 0);
    const arrosage = apports.filter((a) => a.type !== "pluie").reduce((s, a) => s + a.mm, 0);
    if (mode === "journalier") {
      const brut = entree.dr_veille + etc - pluie - arrosage;
      const drainage = Math.max(0, -brut);
      const dr2 = Math.min(dmax, Math.max(0, brut));
      const total = pluie + arrosage;
      const eau_perdue2 = total > 0 ? drainage * arrosage / total : 0;
      return {
        connu: true,
        mode,
        dr: dr2,
        apres_apports: [],
        pic: null,
        drainage,
        eau_perdue: eau_perdue2,
        drainage_pluie: drainage - eau_perdue2,
        compte: { pluie, arrosage }
      };
    }
    let dr = entree.dr_veille, f0 = 0, eau_perdue = 0, drainage_pluie = 0, pic = dr;
    const apres_apports = [];
    for (const a of apports) {
      dr = Math.min(dmax, dr + etc * (a.f - f0));
      f0 = a.f;
      const exces = Math.max(0, a.mm - dr);
      if (a.type === "pluie") drainage_pluie += exces;
      else eau_perdue += exces;
      dr = Math.max(0, dr - a.mm);
      pic = Math.min(pic, dr);
      apres_apports.push({ f: a.f, type: a.type, mm_compte: a.mm, dr });
    }
    dr = Math.min(dmax, dr + etc * (1 - f0));
    pic = Math.min(pic, dr);
    return {
      connu: true,
      mode,
      dr,
      apres_apports,
      pic,
      drainage: eau_perdue + drainage_pluie,
      eau_perdue,
      drainage_pluie,
      compte: { pluie, arrosage }
    };
  }
  var FUSEAU = "Europe/Paris";
  var formats = /* @__PURE__ */ new Map();
  function murale(ms, fuseau) {
    let fmt = formats.get(fuseau);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: fuseau,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      formats.set(fuseau, fmt);
    }
    const p = {};
    for (const x of fmt.formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = Number(x.value);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) + (ms % 1e3 + 1e3) % 1e3;
  }
  function minuitLocal(date, fuseau) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new RangeError("date attendue au format AAAA-MM-JJ");
    const voulu = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    let t = voulu - (murale(voulu, fuseau) - voulu);
    t = voulu - (murale(t, fuseau) - t);
    return t;
  }
  function bornesDuJour(date, fuseau = FUSEAU) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new RangeError("date attendue au format AAAA-MM-JJ");
    const lendemain2 = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)).toISOString().slice(0, 10);
    return { debut: minuitLocal(date, fuseau), fin: minuitLocal(lendemain2, fuseau) };
  }
  function fractionDuJour(instant, date, fuseau = FUSEAU) {
    const t = Date.parse(instant);
    if (!Number.isFinite(t)) throw new RangeError("instant illisible");
    const { debut, fin } = bornesDuJour(date, fuseau);
    return Math.min(1, Math.max(0, (t - debut) / (fin - debut)));
  }
  function apportsDesArrosages(arrosages, date, fuseau = FUSEAU, entre2 = {}) {
    const { debut, fin } = bornesDuJour(date, fuseau);
    const duree = fin - debut;
    const de = Math.min(fin, Math.max(debut, entre2.depuis ?? debut));
    const jusqua = Math.min(fin, Math.max(de, entre2.jusqua ?? fin));
    const sortie = [];
    for (const a of arrosages) {
      const t0 = Date.parse(a.debut);
      if (!Number.isFinite(t0)) throw new RangeError("début d'arrosage illisible");
      const t1 = a.fin === null ? NaN : Date.parse(a.fin);
      const type = a.type ?? "arrosage";
      if (!Number.isFinite(t1) || t1 <= t0) {
        if (t0 >= de && t0 < jusqua) sortie.push({ type, f: (t0 - debut) / duree, mm: a.mm, duree_s: null });
        continue;
      }
      const recouvre = Math.min(t1, jusqua) - Math.max(t0, de);
      if (recouvre <= 0) continue;
      sortie.push({
        type,
        f: (Math.max(t0, de) - debut) / duree,
        mm: a.mm === null ? null : a.mm * recouvre / (t1 - t0),
        duree_s: (t1 - t0) / 1e3
      });
    }
    return sortie;
  }

  // src/observations.ts
  var CLASSES_POING = Object.freeze({
    tres_sec: Object.freeze([-Infinity, 25]),
    sec: Object.freeze([25, 50]),
    correct: Object.freeze([50, 75]),
    frais: Object.freeze([75, 95]),
    plein: Object.freeze([95, Infinity])
  });
  var CENTRE_CLASSE = Object.freeze({
    tres_sec: 12.5,
    sec: 37.5,
    correct: 62.5,
    frais: 87.5,
    plein: 100
  });
  var estClassePoing = (x) => typeof x === "string" && Object.hasOwn(CLASSES_POING, x);
  var INCERTITUDE = Object.freeze({
    /** Au départ du calcul, sans incertitude donnée : 0,35 × RU. */
    depart_part_ru: 0.35,
    /** Erreur de consommation typique (erreur de Kc de ± 20 %), par mm consommé depuis le dernier ancrage. */
    erreur_conso: 0.2,
    /** Un jour dont la consommation est estimée (MC-14) : l'incertitude grandit de 0,5 × cette consommation (§ 4.4). */
    erreur_conso_estimee: 0.5,
    /** Après une observation « manque » (le % du plein d'OTF, MC-22) : 0,05 × RU. */
    apres_manque_part_ru: 0.05,
    /** Après un poing sans fourchette : 0,15 × RU. */
    apres_poing_centre_part_ru: 0.15,
    /** Après un tensiomètre : 0,1 × RAW. */
    apres_tensio_part_raw: 0.1
  });
  var CONSOMMATION_APPRISE = Object.freeze({
    gain: 0.3,
    /** Jusqu'à cette consommation depuis l'ancrage précédent (mm), le relevé n'apprend rien. */
    conso_min_mm: 2,
    facteur_releve_min: 0.85,
    facteur_releve_max: 1.18,
    kf_min: 0.6,
    kf_max: 1.6
  });
  var GRILLE_PAS = 0.5;
  var GRILLE_POINTS = 200;
  var SD_PRIOR_MIN = 1;
  var VARIANCE_MIN = 0.25;
  var VRAISEMBLANCE_MIN = 1e-12;
  var POURCENT = 100;
  var estNombre2 = (x) => typeof x === "number" && Number.isFinite(x);
  var borne = (x, a, b) => Math.min(b, Math.max(a, x));
  function erf(x) {
    const s = Math.sign(x);
    const a = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * a);
    return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a));
  }
  var phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  function poingFourchette(apriori, classes, sigma) {
    if (apriori !== null && (!estNombre2(apriori.um) || !estNombre2(apriori.sdU) || apriori.sdU < 0)) {
      throw new RangeError("poing : état et incertitude du calcul attendus (ou null)");
    }
    if (!estNombre2(sigma) || sigma <= 0) throw new RangeError("poing : erreur de lecture > 0 attendue");
    if (classes.length === 0 || !classes.every(estClassePoing)) throw new RangeError("poing : au moins une classe connue attendue");
    const logs = [];
    let max = -Infinity;
    for (let i = 0; i <= GRILLE_POINTS; i += 1) {
      const u = i * GRILLE_PAS;
      let l = apriori === null ? 0 : -0.5 * ((u - apriori.um) / Math.max(SD_PRIOR_MIN, apriori.sdU)) ** 2;
      for (const c of classes) {
        const [a, b] = CLASSES_POING[c];
        l += Math.log(Math.max(VRAISEMBLANCE_MIN, phi((b - u) / sigma) - phi((a - u) / sigma)));
      }
      logs.push(l);
      max = Math.max(max, l);
    }
    let w0 = 0, m1 = 0, m2 = 0;
    logs.forEach((l, i) => {
      const u = i * GRILLE_PAS;
      const w = Math.exp(l - max);
      w0 += w;
      m1 += w * u;
      m2 += w * u * u;
    });
    const mu = m1 / w0;
    return { mu, sd: Math.sqrt(Math.max(VARIANCE_MIN, m2 / w0 - mu * mu)) };
  }
  function incertitudeMm(sdR_mm, erreur_mm) {
    return Math.sqrt(sdR_mm * sdR_mm + erreur_mm * erreur_mm);
  }
  var enPoints = (mm, ru) => mm / ru * POURCENT;
  var etatEnPoints = (dr_mm, ru) => POURCENT * (1 - dr_mm / ru);
  var manqueDepuisPoints = (points, ru) => (1 - points / POURCENT) * ru;
  function kfApres(kf, r) {
    const k = CONSOMMATION_APPRISE;
    if (!(r.conso_mm > k.conso_min_mm)) return kf;
    const gain = r.sd_avant > 0 ? k.gain * Math.max(0, 1 - (r.sd_apres / r.sd_avant) ** 2) : 0;
    const facteur = borne(1 + gain * (r.dr_apres_mm - r.dr_avant_mm) / r.conso_mm, k.facteur_releve_min, k.facteur_releve_max);
    return borne(kf * facteur, k.kf_min, k.kf_max);
  }
  function tensioVersDr(kpa, bas_kpa, haut_kpa, raw_mm) {
    if (!estNombre2(kpa) || !estNombre2(raw_mm) || raw_mm < 0) throw new RangeError("tensiomètre : mesure et RAW attendues");
    if (!estNombre2(bas_kpa) || bas_kpa <= 0 || !estNombre2(haut_kpa) || haut_kpa <= bas_kpa) throw new RangeError("tensiomètre : 0 < seuil bas < seuil haut");
    if (kpa < bas_kpa) return 0.2 * raw_mm * Math.max(0, kpa) / bas_kpa;
    if (kpa <= haut_kpa) return 0.2 * raw_mm + 0.8 * raw_mm * (kpa - bas_kpa) / (haut_kpa - bas_kpa);
    return 1.05 * raw_mm;
  }

  // src/pluie.ts
  var PLUIE_SURE = Object.freeze({ modeles_min: 2, mm_min_par_modele: 1, part_du_plus_faible: 0.8, retrait_mm: 1 });
  var estNombre3 = (x) => typeof x === "number" && Number.isFinite(x);
  function verifierMm(mm, quoi) {
    if (!estNombre3(mm) || mm < 0) throw new RangeError(`${quoi} : mm ≥ 0 attendus`);
  }
  function retirerInterception(brute, ruissellement, r) {
    const reste = Math.max(0, brute - ruissellement);
    const interception = Math.min(r.interception_mm, reste);
    return { brute_mm: brute, ruissellement_mm: ruissellement, interception_mm: interception, utile_mm: reste - interception };
  }
  function pluieUtileMesuree(heures_mm, r) {
    for (const h of heures_mm) verifierMm(h, "pluie horaire");
    const brute = heures_mm.reduce((s, h) => s + h, 0);
    if (brute <= 0) return { brute_mm: 0, ruissellement_mm: 0, interception_mm: 0, utile_mm: 0 };
    const seuil = r.seuil_ruissellement_mm_h;
    const ruissellement = seuil === null ? 0 : heures_mm.reduce((s, h) => s + Math.max(0, h - seuil) * r.part_ruisselee, 0);
    return retirerInterception(brute, ruissellement, r);
  }
  function pluieUtileDuJour(mm, r) {
    verifierMm(mm, "pluie du jour");
    if (mm <= 0) return { brute_mm: 0, ruissellement_mm: 0, interception_mm: 0, utile_mm: 0 };
    return retirerInterception(mm, 0, r);
  }
  function pluieUtilePrevue(prevue_mm, modeles, r) {
    verifierMm(prevue_mm, "pluie prévue");
    for (const m of modeles ?? []) verifierMm(m, "pluie d'un modèle");
    const base = Math.max(0, prevue_mm * r.part_prevue - r.interception_mm);
    const sure = r.regle_pluie_sure && !!modeles && modeles.length >= PLUIE_SURE.modeles_min && modeles.every((m) => m >= PLUIE_SURE.mm_min_par_modele);
    const utile = sure ? Math.max(base, PLUIE_SURE.part_du_plus_faible * Math.min(...modeles) - PLUIE_SURE.retrait_mm) : base;
    const comptee = prevue_mm * r.part_prevue;
    return {
      brute_mm: prevue_mm,
      ruissellement_mm: 0,
      interception_mm: Math.min(r.interception_mm, comptee),
      utile_mm: utile,
      sure
    };
  }
  function pluieUtile(pluie, r) {
    if (pluie.type === "heures") return pluieUtileMesuree(pluie.heures.map((h) => h.mm), r);
    if (pluie.type === "jour") return pluieUtileDuJour(pluie.mm, r);
    if (pluie.type === "prevue") return pluieUtilePrevue(pluie.mm, pluie.modeles, r);
    throw new RangeError("type de pluie : heures, jour ou prevue");
  }

  // src/reglages.ts
  var QUINZE_HEURES = 15 / 24;
  var SIGMA_POING = 8;
  var PRISES_MIN = 60;
  var RELEVE_PRIORITAIRE_H = 48;
  var JEU_OTF2 = Object.freeze({
    ...JEU_OTF,
    nom: "OTF",
    pluie: Object.freeze({
      interception_mm: 0,
      seuil_ruissellement_mm_h: null,
      part_ruisselee: 0,
      part_prevue: 1,
      regle_pluie_sure: false,
      f_sans_heure: QUINZE_HEURES
    }),
    p_ajuste_chaleur: false,
    jour_inconnu: "inconnu",
    drainage_au_redemarrage: "depuis_capacite",
    conservation: "pourcent",
    nature_observee: false,
    // MC-20 : aucune option de Tlaloc chez OTF.
    poing: Object.freeze({ fourchette: false, sigma_lecture: SIGMA_POING, regroupement_min: PRISES_MIN }),
    tensiometre: Object.freeze({ actif: false, releve_prioritaire_h: RELEVE_PRIORITAIRE_H }),
    consommation_apprise: false
  });
  var JEU_TLALOC2 = Object.freeze({
    ...JEU_TLALOC,
    nom: "Tlaloc",
    pluie: Object.freeze({
      interception_mm: 2,
      seuil_ruissellement_mm_h: 15,
      part_ruisselee: 0.5,
      part_prevue: 0.5,
      regle_pluie_sure: true,
      f_sans_heure: QUINZE_HEURES
    }),
    p_ajuste_chaleur: true,
    jour_inconnu: "moyenne_3_jours",
    drainage_au_redemarrage: "inconnu",
    conservation: "manque",
    nature_observee: true,
    poing: Object.freeze({ fourchette: true, sigma_lecture: SIGMA_POING, regroupement_min: PRISES_MIN }),
    tensiometre: Object.freeze({ actif: true, releve_prioritaire_h: RELEVE_PRIORITAIRE_H }),
    consommation_apprise: true
  });
  var estNombre4 = (x) => typeof x === "number" && Number.isFinite(x);
  var entre = (x, a, b) => estNombre4(x) && x >= a && x <= b;
  function verifierJeu(jeu) {
    if (jeu.pas !== "horaire" && jeu.pas !== "journalier") throw new RangeError("pas : horaire ou journalier");
    const b = jeu.bassinage;
    if (!b) throw new RangeError("jeu.bassinage manquant");
    if (!estNombre4(b.duree_max_s) || b.duree_max_s < 0) throw new RangeError("bassinage.duree_max_s doit être ≥ 0");
    if (!entre(b.part_comptee, 0, 1)) throw new RangeError("bassinage.part_comptee entre 0 et 1");
    const p = jeu.pluie;
    if (!p) throw new RangeError("jeu.pluie manquant");
    if (!estNombre4(p.interception_mm) || p.interception_mm < 0) throw new RangeError("pluie.interception_mm doit être ≥ 0");
    if (p.seuil_ruissellement_mm_h !== null && (!estNombre4(p.seuil_ruissellement_mm_h) || p.seuil_ruissellement_mm_h < 0)) {
      throw new RangeError("pluie.seuil_ruissellement_mm_h : null ou ≥ 0");
    }
    if (!entre(p.part_ruisselee, 0, 1)) throw new RangeError("pluie.part_ruisselee entre 0 et 1");
    if (!entre(p.part_prevue, 0, 1)) throw new RangeError("pluie.part_prevue entre 0 et 1");
    if (typeof p.regle_pluie_sure !== "boolean") throw new RangeError("pluie.regle_pluie_sure : vrai ou faux");
    if (!entre(p.f_sans_heure, 0, 1)) throw new RangeError("pluie.f_sans_heure entre 0 et 1");
    if (jeu.jour_inconnu !== "inconnu" && jeu.jour_inconnu !== "moyenne_3_jours") throw new RangeError("jour_inconnu : inconnu ou moyenne_3_jours");
    if (jeu.drainage_au_redemarrage !== "depuis_capacite" && jeu.drainage_au_redemarrage !== "inconnu") {
      throw new RangeError("drainage_au_redemarrage : depuis_capacite ou inconnu");
    }
    if (jeu.conservation !== "pourcent" && jeu.conservation !== "manque") throw new RangeError("conservation : pourcent ou manque");
    if (typeof jeu.p_ajuste_chaleur !== "boolean") throw new RangeError("p_ajuste_chaleur : vrai ou faux");
    if (typeof jeu.nature_observee !== "boolean") throw new RangeError("nature_observee : vrai ou faux");
    const q = jeu.poing;
    if (!q) throw new RangeError("jeu.poing manquant");
    if (typeof q.fourchette !== "boolean") throw new RangeError("poing.fourchette : vrai ou faux");
    if (!estNombre4(q.sigma_lecture) || q.sigma_lecture <= 0) throw new RangeError("poing.sigma_lecture doit être > 0");
    if (!estNombre4(q.regroupement_min) || q.regroupement_min < 0) throw new RangeError("poing.regroupement_min doit être ≥ 0");
    const t = jeu.tensiometre;
    if (!t) throw new RangeError("jeu.tensiometre manquant");
    if (typeof t.actif !== "boolean") throw new RangeError("tensiometre.actif : vrai ou faux");
    if (!estNombre4(t.releve_prioritaire_h) || t.releve_prioritaire_h < 0) throw new RangeError("tensiometre.releve_prioritaire_h doit être ≥ 0");
    if (typeof jeu.consommation_apprise !== "boolean") throw new RangeError("consommation_apprise : vrai ou faux");
  }

  // src/bilan.ts
  var P_CHALEUR = Object.freeze({ pente: 0.04, etc_reference_mm: 5, min: 0.1, max: 0.8 });
  var JOURS_MOYENNE = 3;
  var POURCENT2 = 100;
  var MINUTE = 6e4;
  var HEURE = 36e5;
  var estNombre5 = (x) => typeof x === "number" && Number.isFinite(x);
  var borne2 = (x, a, b) => Math.min(b, Math.max(a, x));
  function pAjuste(p_tableau, etc_mm) {
    return borne2(p_tableau + P_CHALEUR.pente * (P_CHALEUR.etc_reference_mm - etc_mm), P_CHALEUR.min, P_CHALEUR.max);
  }
  function conserver(dr_mm, dmax_avant, dmax_apres, regle) {
    if (dmax_avant === dmax_apres) return dr_mm;
    if (regle === "manque") return Math.min(dr_mm, dmax_apres);
    const part = dmax_avant > 0 ? borne2(dr_mm / dmax_avant, 0, 1) : 1;
    return part * dmax_apres;
  }
  function lendemain(date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new RangeError("date attendue au format AAAA-MM-JJ");
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)).toISOString().slice(0, 10);
  }
  function verifierEntree(entree) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entree.aujourdhui)) throw new RangeError("aujourdhui : AAAA-MM-JJ");
    entree.jours.forEach((j, i) => {
      if (i > 0 && j.date !== lendemain(entree.jours[i - 1].date)) throw new RangeError(`jours non consécutifs : ${entree.jours[i - 1].date} puis ${j.date}`);
      if (i === 0) lendemain(j.date);
      if (j.etc_mm !== null && (!estNombre5(j.etc_mm) || j.etc_mm < 0)) throw new RangeError(`${j.date} : etc_mm null ou ≥ 0`);
      if (j.sol !== null) {
        const s = j.sol;
        if (!estNombre5(s.theta_u_mm_m) || s.theta_u_mm_m <= 0) throw new RangeError(`${j.date} : theta_u_mm_m > 0`);
        if (!estNombre5(s.zr_m) || s.zr_m <= 0) throw new RangeError(`${j.date} : zr_m > 0`);
        if (s.p_tableau !== null && (!estNombre5(s.p_tableau) || s.p_tableau < 0 || s.p_tableau > 1)) throw new RangeError(`${j.date} : p_tableau null ou entre 0 et 1`);
        if (s.plancher_mm !== null && (!estNombre5(s.plancher_mm) || s.plancher_mm <= 0)) throw new RangeError(`${j.date} : plancher_mm null ou > 0`);
      }
      if (typeof j.abri !== "boolean") throw new RangeError(`${j.date} : abri vrai ou faux`);
      const paillage = j.part_paillage ?? 1;
      if (!estNombre5(paillage) || paillage < 0 || paillage > 1) throw new RangeError(`${j.date} : part_paillage entre 0 et 1`);
    });
    for (const a of entree.arrosages ?? []) {
      if (a.mm !== null && (!estNombre5(a.mm) || a.mm < 0)) throw new RangeError("arrosage : mm null ou ≥ 0");
      if (a.type !== void 0 && a.type !== "arrosage" && a.type !== "bassinage") throw new RangeError("arrosage : type arrosage ou bassinage");
    }
    for (const o of entree.observations ?? []) {
      if (o.type !== "manque" && o.type !== "poing" && o.type !== "tensio") throw new RangeError("observation : type manque, poing ou tensio");
      if (!Number.isFinite(Date.parse(o.instant))) throw new RangeError("observation : instant illisible");
      if (o.type === "manque" && (!estNombre5(o.dr_mm) || o.dr_mm < 0)) throw new RangeError("observation : dr_mm ≥ 0");
      if (o.type === "poing" && !estClassePoing(o.classe)) throw new RangeError("observation : classe tres_sec, sec, correct, frais ou plein");
      if (o.type === "tensio") {
        if (!estNombre5(o.kpa)) throw new RangeError("observation : kpa attendu");
        if (!estNombre5(o.bas_kpa) || o.bas_kpa <= 0 || !estNombre5(o.haut_kpa) || o.haut_kpa <= o.bas_kpa) throw new RangeError("observation : 0 < bas_kpa < haut_kpa");
      }
    }
    const e = entree.etat_initial;
    if (e) {
      if (!estNombre5(e.dr_mm) || e.dr_mm < 0) throw new RangeError("etat_initial.dr_mm ≥ 0");
      if (!estNombre5(e.dmax_mm) || e.dmax_mm <= 0) throw new RangeError("etat_initial.dmax_mm > 0");
      if (e.incertitude_mm != null && (!estNombre5(e.incertitude_mm) || e.incertitude_mm < 0)) throw new RangeError("etat_initial.incertitude_mm null ou ≥ 0");
    }
    const kf = entree.kf;
    if (kf) {
      const { kf_min, kf_max } = CONSOMMATION_APPRISE;
      if (!estNombre5(kf.valeur) || kf.valeur < kf_min || kf.valeur > kf_max) throw new RangeError(`kf.valeur entre ${kf_min} et ${kf_max}`);
      if (kf.depuis != null && !Number.isFinite(Date.parse(kf.depuis))) throw new RangeError("kf.depuis : null ou un instant");
    }
  }
  function apportsDePluie(jour, jeu, debut, fin) {
    if (jour.abri) return { utile_mm: 0, apports: [] };
    if (jour.pluie === null) return null;
    const paillage = jour.part_paillage ?? 1;
    const p = pluieUtile(jour.pluie, jeu.pluie);
    const utile = p.utile_mm * paillage;
    if (jour.pluie.type !== "heures") {
      return { utile_mm: utile, apports: utile > 0 ? [{ type: "pluie", f: jeu.pluie.f_sans_heure, mm: utile }] : [] };
    }
    const coef = p.brute_mm > 0 ? p.utile_mm / p.brute_mm * paillage : 0;
    const apports = [];
    for (const h of jour.pluie.heures) {
      const t = Date.parse(h.instant);
      if (!Number.isFinite(t) || t < debut || t >= fin) throw new RangeError(`${jour.date} : heure de pluie hors du jour`);
      if (h.mm > 0) apports.push({ type: "pluie", f: (t - debut) / (fin - debut), mm: h.mm * coef });
    }
    return { utile_mm: utile, apports };
  }
  function pluieEntre(pluie, jeu, f0, f1) {
    if (jeu.pas === "journalier") {
      const mm = pluie.utile_mm * (f1 - f0);
      return { apports: mm > 0 ? [{ type: "pluie", f: f0, mm }] : [], pluie_mm: mm };
    }
    const dedans = pluie.apports.filter((a) => a.f >= f0 && (a.f < f1 || f1 === 1 && a.f === 1));
    return { apports: dedans, pluie_mm: dedans.reduce((s, a) => s + (a.mm ?? 0), 0) };
  }
  function sousPas(dr, etc, sol, apports, f0, f1, jeu) {
    const largeur = f1 - f0;
    const ramenes = apports.map((a) => ({ ...a, f: largeur > 0 ? borne2((a.f - f0) / largeur, 0, 1) : 0 }));
    const entree = { dr_veille: dr, etc: etc * largeur, ru: sol.ru, plancher: sol.plancher, apports: ramenes };
    const s = pasDuJour(entree, jeu);
    if (!s.connu) return s;
    return { ...s, apres_apports: s.apres_apports.map((a) => ({ ...a, f: f0 + a.f * largeur })) };
  }
  var parHeure = (a, b) => a.t - b.t || a.rang - b.rang;
  function candidatsDAncrage(observations, jeu) {
    const candidats = [];
    const prises = [];
    const terrain = [];
    observations.forEach((o, rang) => {
      const t = Date.parse(o.instant);
      if (o.type === "manque") candidats.push({ t, instant: o.instant, rang, type: "manque", dr_mm: o.dr_mm });
      if (o.type === "poing") prises.push({ t, rang, instant: o.instant, classe: o.classe });
      if (o.type !== "tensio") terrain.push(t);
    });
    prises.sort(parHeure);
    const fenetre = jeu.poing.fourchette ? jeu.poing.regroupement_min * MINUTE : 0;
    for (let i = 0; i < prises.length; ) {
      let j = i;
      while (j + 1 < prises.length && prises[j + 1].t - prises[i].t < fenetre) j += 1;
      const derniere = prises[j];
      candidats.push({ t: derniere.t, instant: derniere.instant, rang: derniere.rang, type: "poing", classes: prises.slice(i, j + 1).map((x) => x.classe) });
      i = j + 1;
    }
    if (jeu.tensiometre.actif) {
      const delai = jeu.tensiometre.releve_prioritaire_h * HEURE;
      observations.forEach((o, rang) => {
        if (o.type !== "tensio") return;
        const t = Date.parse(o.instant);
        if (terrain.some((x) => t - x >= 0 && t - x < delai)) return;
        candidats.push({ t, instant: o.instant, rang, type: "tensio", kpa: o.kpa, bas_kpa: o.bas_kpa, haut_kpa: o.haut_kpa });
      });
    }
    return candidats.sort(parHeure);
  }
  function valeurObservee(c, drCalcule, sdAvant, sol, jeu) {
    if (c.type === "manque") return { dr: Math.min(sol.dmax, c.dr_mm), sd: INCERTITUDE.apres_manque_part_ru * sol.ru, fourchette: false };
    if (c.type === "tensio") {
      const raw = sol.raw;
      return { dr: Math.min(sol.dmax, tensioVersDr(c.kpa, c.bas_kpa, c.haut_kpa, raw)), sd: INCERTITUDE.apres_tensio_part_raw * raw, fourchette: false };
    }
    if (!jeu.poing.fourchette) {
      const centre = CENTRE_CLASSE[c.classes[c.classes.length - 1]];
      return { dr: borne2(manqueDepuisPoints(centre, sol.ru), 0, sol.dmax), sd: INCERTITUDE.apres_poing_centre_part_ru * sol.ru, fourchette: false };
    }
    const apriori = drCalcule === null || sdAvant === null ? null : { um: etatEnPoints(drCalcule, sol.ru), sdU: enPoints(sdAvant, sol.ru) };
    const r = poingFourchette(apriori, c.classes, jeu.poing.sigma_lecture);
    return { dr: borne2(manqueDepuisPoints(r.mu, sol.ru), 0, sol.dmax), sd: r.sd / POURCENT2 * sol.ru, fourchette: apriori !== null };
  }
  function suivre(entree, jeu) {
    verifierJeu(jeu);
    verifierEntree(entree);
    const fuseau = entree.fuseau ?? FUSEAU;
    const arrosages = entree.arrosages ?? [];
    const candidats = candidatsDAncrage(entree.observations ?? [], jeu);
    const sorties = [];
    const apprend = jeu.consommation_apprise;
    let kfAppris = apprend ? entree.kf?.valeur ?? 1 : 1;
    let kfDepuis = apprend ? entree.kf?.depuis ?? null : null;
    const e0 = entree.etat_initial;
    const sol0 = entree.jours[0]?.sol ?? null;
    let etat = e0 ? {
      dr: borne2(e0.dr_mm, 0, e0.dmax_mm),
      dmax: e0.dmax_mm,
      sdR: e0.incertitude_mm ?? (sol0 === null ? null : INCERTITUDE.depart_part_ru * sol0.theta_u_mm_m * sol0.zr_m),
      erreur: 0,
      conso: 0,
      ancre: false
    } : null;
    let raison = { code: "pas_commence", date: null };
    const etmConnues = [];
    let prochain = 0;
    for (const jour of entree.jours) {
      const kf = kfAppris;
      const { debut, fin } = bornesDuJour(jour.date, fuseau);
      const duree = fin - debut;
      const nature = jour.date < entree.aujourdhui ? "estime" : "prevu";
      const ru = jour.sol ? jour.sol.theta_u_mm_m * jour.sol.zr_m : null;
      const plancher = jour.sol ? jour.sol.plancher_mm : null;
      const dmax = ru === null ? null : plancher === null ? ru : Math.min(ru, plancher);
      let etc = jour.etc_mm === null ? null : jour.etc_mm * kf;
      let etc_estimee = false;
      if (etc === null && jeu.jour_inconnu === "moyenne_3_jours" && etmConnues.length > 0) {
        const dernieres = etmConnues.slice(-JOURS_MOYENNE);
        etc = dernieres.reduce((s2, x) => s2 + x, 0) / dernieres.length * kf;
        etc_estimee = true;
      }
      if (jour.etc_mm !== null) etmConnues.push(jour.etc_mm);
      const p = jour.sol?.p_tableau == null ? null : !jeu.p_ajuste_chaleur ? jour.sol.p_tableau : etc === null ? null : pAjuste(jour.sol.p_tableau, etc);
      const raw = p === null || ru === null ? null : p * ru;
      const avantObservation = etat !== null && dmax !== null ? conserver(etat.dr, etat.dmax, dmax, jeu.conservation) : null;
      const duJour = [];
      for (; prochain < candidats.length && candidats[prochain].t < fin; prochain += 1) {
        if (candidats[prochain].t >= debut) duJour.push(candidats[prochain]);
      }
      const ancres = dmax === null ? [] : duJour.filter((c) => c.type !== "tensio" || raw !== null);
      const derniere = ancres.length > 0 ? ancres[ancres.length - 1] : null;
      const tCompte = derniere === null ? debut : derniere.t;
      const f0 = (tCompte - debut) / duree;
      const redemarrage = derniere === null ? null : "observation";
      const fraction = 1 - f0;
      const pluie = apportsDePluie(jour, jeu, debut, fin);
      const pluieComptee = pluie === null ? null : pluieEntre(pluie, jeu, f0, 1);
      const arr = apportsDesArrosages(arrosages, jour.date, fuseau, { depuis: tCompte });
      let manqueApport = null;
      let arrosageConnu = 0;
      for (const a of arr) {
        const c = mmCompte(a, jeu);
        if ("raison" in c) manqueApport ?? (manqueApport = { code: c.raison === "duree_bassinage_inconnue" ? c.raison : "apport_inconnu", date: jour.date });
        else arrosageConnu += c.mm;
      }
      const base = {
        date: jour.date,
        nature,
        ru_mm: ru,
        p,
        raw_mm: raw,
        dmax_mm: dmax,
        pluie_mm: pluieComptee === null ? null : pluieComptee.pluie_mm,
        arrosage_mm: arrosageConnu,
        etc_mm: etc === null ? null : etc * fraction,
        etc_estimee,
        fraction,
        apres_apports: []
      };
      const trou = etc === null ? { code: "etc_inconnue", date: jour.date, detail: jour.etc_raison ?? null } : pluie === null ? { code: "pluie_inconnue", date: jour.date } : dmax === null ? { code: "sol_inconnu", date: jour.date } : manqueApport;
      if (trou !== null || avantObservation === null && derniere === null) {
        const entrees = (pluieComptee?.pluie_mm ?? 0) + arrosageConnu;
        if (dmax !== null && entrees >= dmax) {
          const drainage = jeu.drainage_au_redemarrage === "depuis_capacite" ? Math.max(0, entrees - dmax) : null;
          const total = (pluieComptee?.pluie_mm ?? 0) + arrosageConnu;
          const eau_perdue = drainage === null || pluieComptee === null ? null : total > 0 ? drainage * arrosageConnu / total : 0;
          sorties.push({
            ...base,
            connu: true,
            dr_mm: 0,
            dr_depart_mm: null,
            pct_plein: POURCENT2,
            drainage_mm: drainage,
            eau_perdue_mm: eau_perdue,
            drainage_pluie_mm: drainage === null || eau_perdue === null ? null : drainage - eau_perdue,
            drainage_borne_basse: drainage !== null,
            redemarrage: "remplissage",
            raison_inconnu: null,
            pic_mm: null,
            incertitude_mm: 0,
            ancrages: [],
            kf_apres: null
          });
          etat = { dr: 0, dmax, sdR: 0, erreur: 0, conso: 0, ancre: true };
          raison = { code: "pas_commence", date: null };
          continue;
        }
        const nommee = trou !== null && (etat !== null || duJour.length > 0) ? trou : raison;
        sorties.push({
          ...base,
          connu: false,
          dr_mm: null,
          dr_depart_mm: null,
          pct_plein: null,
          drainage_mm: null,
          eau_perdue_mm: null,
          drainage_pluie_mm: null,
          drainage_borne_basse: false,
          redemarrage: null,
          raison_inconnu: nommee,
          pic_mm: null,
          incertitude_mm: null,
          ancrages: [],
          kf_apres: null
        });
        etat = null;
        raison = nommee;
        continue;
      }
      const sol = { ru, plancher };
      const etcDuJour = etc;
      const pluieDuJour = pluie;
      const coefErreur = etc_estimee ? INCERTITUDE.erreur_conso_estimee : INCERTITUDE.erreur_conso;
      let dr = avantObservation;
      let suivi = etat === null ? null : { sdR: etat.sdR, erreur: etat.erreur, conso: etat.conso, ancre: etat.ancre };
      const ancrages = [];
      let kf_apres = null;
      let tPrec = debut;
      let fPrec = 0;
      for (const c of ancres) {
        const fc = (c.t - debut) / duree;
        let drCalcule = null;
        if (dr !== null) {
          const avant = sousPas(dr, etcDuJour, sol, [
            ...pluieEntre(pluieDuJour, jeu, fPrec, fc).apports,
            ...apportsDesArrosages(arrosages, jour.date, fuseau, { depuis: tPrec, jusqua: c.t })
          ], fPrec, fc, jeu);
          drCalcule = avant.connu ? avant.dr : null;
        }
        const conso = etcDuJour * (fc - fPrec);
        suivi = drCalcule === null || suivi === null ? null : { ...suivi, erreur: suivi.erreur + coefErreur * conso, conso: suivi.conso + conso };
        const sdAvant = suivi === null || suivi.sdR === null ? null : incertitudeMm(suivi.sdR, suivi.erreur);
        const v = valeurObservee(c, drCalcule, sdAvant, { ru: sol.ru, dmax, raw }, jeu);
        if (apprend && v.fourchette && suivi !== null && suivi.ancre && sdAvant !== null && drCalcule !== null && suivi.conso > CONSOMMATION_APPRISE.conso_min_mm && (kfDepuis === null || c.t > Date.parse(kfDepuis))) {
          kfAppris = kfApres(kfAppris, { dr_avant_mm: drCalcule, dr_apres_mm: v.dr, conso_mm: suivi.conso, sd_avant: sdAvant, sd_apres: v.sd });
          kfDepuis = c.instant;
          kf_apres = { valeur: kfAppris, depuis: c.instant };
        }
        ancrages.push({
          instant: c.instant,
          type: c.type,
          prises: c.type === "poing" ? c.classes.length : 1,
          dr_observe_mm: v.dr,
          dr_calcule_mm: drCalcule,
          incertitude_avant_mm: sdAvant,
          incertitude_apres_mm: v.sd
        });
        dr = v.dr;
        suivi = { sdR: v.sd, erreur: 0, conso: 0, ancre: true };
        tPrec = c.t;
        fPrec = fc;
      }
      const depart = dr;
      const apports = [...pluieComptee.apports, ...arr];
      const s = sousPas(depart, etcDuJour, sol, apports, f0, 1, jeu);
      if (!s.connu) throw new Error("pas inconnu alors que ses entrées sont connues");
      const consoFin = etcDuJour * fraction;
      if (suivi !== null) suivi = { ...suivi, erreur: suivi.erreur + coefErreur * consoFin, conso: suivi.conso + consoFin };
      sorties.push({
        ...base,
        nature: jeu.nature_observee && redemarrage === "observation" ? "observe" : nature,
        connu: true,
        dr_mm: s.dr,
        dr_depart_mm: depart,
        pct_plein: dmax !== null && dmax > 0 ? (1 - s.dr / dmax) * POURCENT2 : null,
        drainage_mm: s.drainage,
        eau_perdue_mm: s.eau_perdue,
        drainage_pluie_mm: s.drainage_pluie,
        drainage_borne_basse: false,
        pluie_mm: s.compte.pluie,
        arrosage_mm: s.compte.arrosage,
        redemarrage,
        raison_inconnu: null,
        pic_mm: s.pic,
        apres_apports: s.apres_apports,
        incertitude_mm: suivi === null || suivi.sdR === null ? null : incertitudeMm(suivi.sdR, suivi.erreur),
        ancrages,
        kf_apres
      });
      etat = { dr: s.dr, dmax, ...suivi ?? { sdR: null, erreur: 0, conso: 0, ancre: false } };
      raison = { code: "pas_commence", date: null };
    }
    return sorties;
  }

  // src/moteur.ts
  var VERSION_MOTEUR = "0.2.0";
  return __toCommonJS(moteur_exports);
})();
