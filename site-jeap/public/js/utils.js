// Fonctions utilitaires partagées entre les pages.

// Échappe les caractères spéciaux HTML pour empêcher toute injection de code
// (XSS) lorsqu'on insère du texte venant de la base de données (titres de
// documents, noms d'utilisateurs, actualités...) dans le DOM via innerHTML.
// À utiliser SYSTÉMATIQUEMENT autour de toute donnée provenant de Supabase
// avant de l'insérer dans un template HTML.
export function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Échappe une valeur destinée à être utilisée à l'intérieur d'un
// background-image: url('...') en CSS inline, pour éviter qu'une URL
// malveillante ne casse hors de l'attribut style.
export function safeUrl(value) {
  if (!value) return '';
  // On n'autorise que des URLs http(s) ou des chemins relatifs simples.
  const trimmed = String(value).trim();
  if (/^https?:\/\//i.test(trimmed) || /^\.?\//.test(trimmed)) {
    return trimmed.replaceAll("'", '%27').replaceAll('"', '%22');
  }
  return '';
}
