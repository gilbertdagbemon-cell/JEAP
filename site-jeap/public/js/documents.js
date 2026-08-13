import { supabase } from './supabaseClient.js';
import { escapeHTML } from './utils.js';

const grid = document.getElementById('documents-grid');
const searchInput = document.getElementById('search-input');
const filterFaculty = document.getElementById('filter-faculty');
const filterLevel = document.getElementById('filter-level');
const filterType = document.getElementById('filter-type');
const filterYear = document.getElementById('filter-year');

const modal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('modal-title');
const pdfFrame = document.getElementById('pdf-frame');
const closeModal = document.getElementById('close-modal');

let allDocuments = [];

// Charger les documents depuis Supabase (avec jointure sur les tables de référence)
// Remarque perf : on ne sélectionne que les colonnes réellement utilisées par
// l'affichage/les filtres (id, title, file_url + libellés des tables liées),
// au lieu de "*" qui rapatrie aussi subject, file_name, file_size, mime_type,
// uploader_id, status, downloads_count, updated_at... jamais utilisés ici.
// Cela réduit sensiblement le volume de données transférées, surtout quand
// la bibliothèque contient beaucoup de documents.
async function fetchDocuments() {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        id,
        title,
        file_url,
        created_at,
        faculties ( code, name ),
        levels ( code, label ),
        document_types ( code, label ),
        academic_years ( year_label )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Aplatit les champs joints pour garder le même format que renderDocuments/applyFilters attendent
    allDocuments = (data || []).map(doc => ({
      ...doc,
      faculty_code: doc.faculties?.code || '',
      level_code: doc.levels?.code || '',
      document_type_code: doc.document_types?.code || '',
      academic_year_label: doc.academic_years?.year_label || ''
    }));

    applyFacultyFromUrl();
    applyFilters();
  } catch (err) {
    grid.innerHTML = `<p class="text-xs text-red-500 col-span-full text-center py-8">Erreur de chargement : ${escapeHTML(err.message)}</p>`;
  }
}

// Pré-sélectionne le filtre Faculté (?faculty=CODE) et/ou la recherche (?q=...)
// si l'URL contient ces paramètres (liens venant de la page d'accueil)
function applyFacultyFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const faculty = params.get('faculty');
  const query = params.get('q');
  if (faculty && filterFaculty) {
    filterFaculty.value = faculty;
  }
  if (query && searchInput) {
    searchInput.value = query;
  }
}

// Afficher les cartes de documents
// Remarque sécurité : toutes les données venant de Supabase (title, faculty_code...)
// sont passées dans escapeHTML() avant insertion dans le HTML, car un membre
// pourrait avoir déposé un document avec un titre contenant du code malveillant
// (ex. <img src=x onerror=...>). Sans cet échappement, ce code s'exécuterait
// dans le navigateur de tous les visiteurs (faille XSS).
function renderDocuments(docs) {
  if (docs.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-3xl mb-2">🔍</div>
        <p class="text-sm font-semibold text-gray-600">Aucun document ne correspond à votre recherche.</p>
        <p class="text-xs text-gray-500 mt-1">Essayez un autre mot-clé ou élargissez vos filtres.</p>
        <button type="button" id="btn-reset-filters" class="btn-secondary text-xs mt-4">Réinitialiser les filtres</button>
      </div>`;
    document.getElementById('btn-reset-filters')?.addEventListener('click', resetFilters);
    return;
  }

  grid.innerHTML = docs.map(doc => `
    <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
      <div>
        <div class="flex justify-between items-start gap-2 mb-2">
          <span class="text-xs font-bold uppercase px-2 py-0.5 rounded bg-jeap-bg text-jeap-green">
            ${escapeHTML(doc.faculty_code || 'UP')} • ${escapeHTML(doc.level_code || '')}
          </span>
          <span class="text-xs text-gray-500">${escapeHTML(doc.academic_year_label || '')}</span>
        </div>
        <h3 class="font-semibold text-sm mb-1 text-gray-800 line-clamp-2">${escapeHTML(doc.title)}</h3>
      </div>

      <div class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
        <button type="button" data-preview-id="${escapeHTML(doc.id)}" aria-label="Aperçu du document ${escapeHTML(doc.title)}"
                class="btn-preview text-xs font-semibold text-jeap-accent hover:underline flex items-center gap-1">
          👁️ Aperçu
        </button>
        <a href="${escapeHTML(doc.file_url)}" download target="_blank" data-download-id="${escapeHTML(doc.id)}" aria-label="Télécharger ${escapeHTML(doc.title)}"
           class="btn-download text-xs btn-secondary py-1 px-3">
          📥 Télécharger
        </a>
      </div>
    </div>
  `).join('');
}

// Gestion des filtres et recherche
function applyFilters() {
  const query = searchInput.value.toLowerCase();
  const faculty = filterFaculty.value;
  const level = filterLevel.value;
  const type = filterType.value;
  const year = filterYear?.value || '';

  const filtered = allDocuments.filter(doc => {
    const matchesQuery = doc.title.toLowerCase().includes(query);
    const matchesFaculty = !faculty || doc.faculty_code === faculty;
    const matchesLevel = !level || doc.level_code === level;
    const matchesType = !type || doc.document_type_code === type;
    const matchesYear = !year || doc.academic_year_label === year || doc.year === year || doc.academic_year === year;

    return matchesQuery && matchesFaculty && matchesLevel && matchesType && matchesYear;
  });

  renderDocuments(filtered);
}

// Réinitialise la recherche et tous les filtres, puis réaffiche tous les documents
function resetFilters() {
  searchInput.value = '';
  filterFaculty.value = '';
  filterLevel.value = '';
  filterType.value = '';
  if (filterYear) filterYear.value = '';
  applyFilters();
}

// Événements
searchInput?.addEventListener('input', applyFilters);
filterFaculty?.addEventListener('change', applyFilters);
filterLevel?.addEventListener('change', applyFilters);
filterType?.addEventListener('change', applyFilters);
filterYear?.addEventListener('change', applyFilters);

// Incrémente le compteur de téléchargements (fonction SQL dédiée, cf. schema.sql)
function trackDownload(docId) {
  supabase.rpc('increment_downloads', { doc_id: docId }).then(({ error }) => {
    if (error) console.warn("Impossible de mettre à jour le compteur de téléchargements :", error.message);
  });
}

function openPreview(doc) {
  if (modalTitle) modalTitle.textContent = doc.title; // textContent : pas besoin d'échapper, pas de HTML interprété
  if (pdfFrame) pdfFrame.src = doc.file_url;
  if (modal) modal.classList.remove('hidden');
}

// Délégation d'événements : plus besoin d'onclick inline (fragile et
// potentiellement exploitable), on retrouve le document via son id dans
// allDocuments à partir de l'attribut data-* du bouton cliqué.
grid?.addEventListener('click', (e) => {
  const previewBtn = e.target.closest('.btn-preview');
  if (previewBtn) {
    const doc = allDocuments.find(d => d.id === previewBtn.dataset.previewId);
    if (doc) openPreview(doc);
    return;
  }

  const downloadLink = e.target.closest('.btn-download');
  if (downloadLink) {
    trackDownload(downloadLink.dataset.downloadId);
  }
});

closeModal?.addEventListener('click', () => {
  if (modal) modal.classList.add('hidden');
  if (pdfFrame) pdfFrame.src = '';
});

// Chargement initial
fetchDocuments();
