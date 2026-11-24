/**
 * Dates civiles du banc (« AAAA-MM-JJ »), sans fuseau : ce sont les jours de
 * Paris tels qu'Open-Meteo les donne avec `timezone=Europe/Paris`.
 */

/** Le jour `n` jours après `date` (n peut être négatif). */
export function jourSuivant(date: string, n = 1): string {
  const [a, m, j] = date.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

/** Tous les jours de `debut` à `fin`, bornes comprises. */
export function joursEntre(debut: string, fin: string): string[] {
  const jours: string[] = [];
  for (let d = debut; d <= fin; d = jourSuivant(d)) jours.push(d);
  return jours;
}

/** Vrai pour une date civile valide écrite « AAAA-MM-JJ ». */
export function estDate(texte: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) return false;
  return jourSuivant(texte, 0) === texte;
}

/**
 * Fenêtre de météo d'une année rejouée (contrat du banc, § 4, réponse à Nicolas
 * du 24/11) : du 15 octobre de l'année d'avant au 12 janvier de l'année d'après.
 * Tlaloc s'y met en route 14 jours, regarde 60 jours en arrière et 12 en avant.
 */
export function fenetreMeteo(annee: number): { debut: string; fin: string } {
  return { debut: `${annee - 1}-10-15`, fin: `${annee + 1}-01-12` };
}

/** L'année entière : du 1er janvier au 31 décembre (MC-36). */
export function bornesAnnee(annee: number): { debut: string; fin: string } {
  return { debut: `${annee}-01-01`, fin: `${annee}-12-31` };
}
