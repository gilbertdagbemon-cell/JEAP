// Génération dynamique des années académiques futures
export function initAcademicYears(selectId = "doc-year") {
  const select = document.getElementById(selectId);
  if (!select) return;

  const anneeDepart = new Date().getFullYear();
  const nombreAnneesFutures = 20;
  const annees = Array.from({length: nombreAnneesFutures}, (_, i) => {
    const y = anneeDepart + i;
    return `${y}-${y + 1}`;
  });

  function remplir(toutes = false) {
    select.innerHTML = '';
    const defaut = new Option("Choisir l'année académique...", "");
    defaut.disabled = true;
    defaut.selected = true;
    select.add(defaut);

    annees.slice(0, toutes ? annees.length : 4).forEach(a => {
      select.add(new Option(a, a));
    });

    if (!toutes) {
      const more = new Option("➕ Choisir d'autres années...", "__MORE__");
      more.style.fontWeight = "bold";
      select.add(more);
    }
  }

  remplir(false);

  select.addEventListener('change', () => {
    if (select.value === '__MORE__') {
      remplir(true);
      select.value = '';
    }
  });
}
