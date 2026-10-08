import { supabase } from './supabaseClient.js';
import { escapeHTML, safeUrl } from './utils.js';

const grid = document.getElementById('documents-grid');

const searchInput = document.getElementById('search-input');
const filterFaculty = document.getElementById('filter-faculty');
const filterDepartment = document.getElementById('filter-department');
const filterLevel = document.getElementById('filter-level');
const filterType = document.getElementById('filter-type');
const filterYear = document.getElementById('filter-year');

const modal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('modal-title');
const pdfFrame = document.getElementById('pdf-frame');
const closeModal = document.getElementById('close-modal');

const PAGE_SIZE = 24;

let currentPage = 0;
let currentDocuments = [];
let searchTimer = null;
let requestId = 0;

/*
 * pageCursors[0] = null
 * pageCursors[1] = curseur permettant de charger la page 2
 * pageCursors[2] = curseur permettant de charger la page 3
 * etc.
 */
let pageCursors = [null];

let hasNextPage = false;

// ========================================================
// OUTILS
// ========================================================

function getFilters() {
  return {
    query: searchInput?.value.trim() || '',
    faculty: filterFaculty?.value || '',
    department: filterDepartment?.value || '',
    level: filterLevel?.value || '',
    type: filterType?.value || '',
    year: filterYear?.value || ''
  };
}

function resetPagination() {
  currentPage = 0;
  pageCursors = [null];
  hasNextPage = false;
}

function showLoading() {
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-span-full text-center py-12">
      <div class="text-3xl mb-2">⏳</div>

      <p class="text-sm font-semibold text-gray-600">
        Chargement des documents...
      </p>

      <p class="text-xs text-gray-500 mt-1">
        Veuillez patienter.
      </p>
    </div>
  `;
}

function showError(message) {
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-span-full text-center py-12">
      <div class="text-3xl mb-2">⚠️</div>

      <p class="text-sm font-semibold text-red-600">
        Erreur lors du chargement des documents.
      </p>

      <p class="text-xs text-gray-500 mt-1">
        ${escapeHTML(message || 'Une erreur inattendue est survenue.')}
      </p>

      <button
        type="button"
        id="btn-retry-documents"
        class="btn-secondary text-xs mt-4"
      >
        Réessayer
      </button>
    </div>
  `;

  document
    .getElementById('btn-retry-documents')
    ?.addEventListener('click', () => {
      fetchDocuments(currentPage);
    });
}

function normalizeDocument(doc) {
  return {
    id: doc.id,
    title: doc.title || '',
    file_url: doc.file_url || '',
    created_at: doc.created_at || '',

    faculty_code: doc.faculties?.code || '',
    faculty_name: doc.faculties?.name || '',

    program_code: doc.programs?.code || '',
    program_name: doc.programs?.name || '',

    level_code: doc.levels?.code || '',
    level_label: doc.levels?.label || '',

    document_type_code: doc.document_types?.code || '',
    document_type_label: doc.document_types?.label || '',

    academic_year_label: doc.academic_years?.year_label || ''
  };
}

// ========================================================
// ANNÉES ACADÉMIQUES
// ========================================================

async function loadAcademicYears() {
  if (!filterYear) return;

  try {
    const { data, error } = await supabase
      .from('academic_years')
      .select('id, year_label')
      .eq('is_active', true)
      .order('year_label', {
        ascending: false
      });

    if (error) throw error;

    const selectedValue = filterYear.value;

    filterYear.innerHTML = `
      <option value="">Toutes les années</option>
    `;

    (data || []).forEach((year) => {
      const option = document.createElement('option');

      option.value = year.year_label;
      option.textContent = year.year_label;

      filterYear.appendChild(option);
    });

    if (selectedValue) {
      const exists = [...filterYear.options].some(
        (option) => option.value === selectedValue
      );

      if (exists) {
        filterYear.value = selectedValue;
      }
    }
  } catch (error) {
    console.warn(
      'Impossible de charger les années académiques :',
      error.message
    );
  }
}

// ========================================================
// PARAMÈTRES DE L'URL
// ========================================================

function applyFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);

  const faculty = params.get('faculty');
  const department = params.get('department');
  const level = params.get('level');
  const type = params.get('type');
  const year = params.get('year');
  const query = params.get('q');

  if (faculty && filterFaculty) {
    filterFaculty.value = faculty;
  }

  if (department && filterDepartment) {
    filterDepartment.value = department;
  }

  if (level && filterLevel) {
    filterLevel.value = level;
  }

  if (type && filterType) {
    filterType.value = type;
  }

  if (year && filterYear) {
    filterYear.value = year;
  }

  if (query && searchInput) {
    searchInput.value = query;
  }
}

// ========================================================
// CHARGEMENT DES DOCUMENTS
// PAGINATION PAR CURSEUR
// ========================================================

async function fetchDocuments(page = 0) {
  if (!grid) return;

  currentPage = Math.max(0, page);

  const thisRequestId = ++requestId;

  showLoading();

  const {
    query,
    faculty,
    department,
    level,
    type,
    year
  } = getFilters();

  /*
   * Le curseur de la page actuelle.
   *
   * Exemple :
   * page 0 → aucun curseur
   * page 1 → dernier document de la page 0
   * page 2 → dernier document de la page 1
   */
  const cursor = pageCursors[currentPage] || null;

  try {
    let request = supabase
      .from('documents')
      .select(`
        id,
        title,
        file_url,
        created_at,

        faculties!inner (
          code,
          name
        ),

        programs!inner (
          code,
          name
        ),

        levels!inner (
          code,
          label
        ),

        document_types!inner (
          code,
          label
        ),

        academic_years!inner (
          year_label
        )
      `)
      .eq('status', 'published');

    // Recherche par titre
    if (query) {
      request = request.ilike(
        'title',
        `%${query}%`
      );
    }

    // Filtre faculté
    if (faculty) {
      request = request.eq(
        'faculties.code',
        faculty
      );
    }

    // Filtre filière
    if (department) {
      request = request.eq(
        'programs.code',
        department
      );
    }

    // Filtre niveau
    if (level) {
      request = request.eq(
        'levels.code',
        level
      );
    }

    // Filtre type
    if (type) {
      request = request.eq(
        'document_types.code',
        type
      );
    }

    // Filtre année
    if (year) {
      request = request.eq(
        'academic_years.year_label',
        year
      );
    }

    /*
     * Pagination par curseur.
     *
     * Le tri est :
     * 1. created_at DESC
     * 2. id DESC
     *
     * Le deuxième champ permet de garantir un ordre stable
     * lorsque plusieurs documents ont exactement la même date.
     */
    if (cursor) {
      request = request.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      );
    }

    /*
     * On demande 1 document supplémentaire.
     *
     * Exemple :
     * PAGE_SIZE = 24
     * requête = 25 documents
     *
     * Si 25 documents sont retournés :
     * → les 24 premiers sont affichés
     * → le 25e sert uniquement à savoir qu'une page suivante existe.
     */
    const {
      data,
      error
    } = await request
      .order('created_at', {
        ascending: false
      })
      .order('id', {
        ascending: false
      })
      .limit(PAGE_SIZE + 1);

    if (thisRequestId !== requestId) {
      return;
    }

    if (error) {
      throw error;
    }

    const rawDocuments = data || [];

    /*
     * Une page suivante existe uniquement si Supabase
     * nous a retourné plus de PAGE_SIZE documents.
     */
    hasNextPage = rawDocuments.length > PAGE_SIZE;

    /*
     * On conserve uniquement les PAGE_SIZE documents
     * destinés à l'affichage.
     */
    const pageDocuments = rawDocuments.slice(
      0,
      PAGE_SIZE
    );

    currentDocuments = pageDocuments.map(
      normalizeDocument
    );

    /*
     * Préparation du curseur de la page suivante.
     *
     * Le dernier document affiché devient le point
     * de départ pour la prochaine requête.
     */
    if (hasNextPage && pageDocuments.length > 0) {
      const lastDocument =
        pageDocuments[pageDocuments.length - 1];

      pageCursors[currentPage + 1] = {
        created_at: lastDocument.created_at,
        id: lastDocument.id
      };
    } else {
      /*
       * Aucun document supplémentaire.
       * On supprime les éventuels anciens curseurs
       * devenus inutiles après cette page.
       */
      pageCursors.length = currentPage + 1;
    }

    renderDocuments(currentDocuments);
    renderPagination();

  } catch (error) {
    if (thisRequestId !== requestId) {
      return;
    }

    console.error(
      'Erreur de chargement des documents :',
      error
    );

    showError(error.message);

  } finally {
    if (thisRequestId === requestId) {
      // La requête courante est terminée.
    }
  }
}

// ========================================================
// AFFICHAGE DES DOCUMENTS
// ========================================================

function renderDocuments(documents) {
  if (!grid) return;

  if (documents.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="text-3xl mb-2">🔍</div>

        <p class="text-sm font-semibold text-gray-600">
          Aucun document ne correspond à votre recherche.
        </p>

        <p class="text-xs text-gray-500 mt-1">
          Essayez un autre mot-clé ou élargissez vos filtres.
        </p>

        <button
          type="button"
          id="btn-reset-filters"
          class="btn-secondary text-xs mt-4"
        >
          Réinitialiser les filtres
        </button>
      </div>
    `;

    document
      .getElementById('btn-reset-filters')
      ?.addEventListener(
        'click',
        resetFilters
      );

    return;
  }

  grid.innerHTML = documents
    .map((doc) => {
      const fileUrl = safeUrl(
        doc.file_url
      );

      return `
        <div
          class="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition"
        >

          <div>

            <div class="flex justify-between items-start gap-2 mb-2">

              <span
                class="text-xs font-bold uppercase px-2 py-0.5 rounded bg-jeap-bg text-jeap-green"
              >
                ${escapeHTML(
                  doc.faculty_code || 'UP'
                )}
                •
                ${escapeHTML(
                  doc.level_code || ''
                )}
              </span>

              <span
                class="text-xs text-gray-500"
              >
                ${escapeHTML(
                  doc.academic_year_label || ''
                )}
              </span>

            </div>

            <h3
              class="font-semibold text-sm mb-1 text-gray-800 line-clamp-2"
            >
              ${escapeHTML(doc.title)}
            </h3>

          </div>

          <div
            class="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between"
          >

            <button
              type="button"
              data-preview-id="${escapeHTML(doc.id)}"
              aria-label="Aperçu du document ${escapeHTML(doc.title)}"
              class="btn-preview text-xs font-semibold text-jeap-accent hover:underline flex items-center gap-1"
            >
              👁️ Aperçu
            </button>

            ${
              fileUrl
                ? `
                  <a
                    href="${escapeHTML(fileUrl)}"
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    data-download-id="${escapeHTML(doc.id)}"
                    aria-label="Télécharger ${escapeHTML(doc.title)}"
                    class="btn-download text-xs btn-secondary py-1 px-3"
                  >
                    📥 Télécharger
                  </a>
                `
                : `
                  <span class="text-xs text-red-500">
                    Fichier indisponible
                  </span>
                `
            }

          </div>

        </div>
      `;
    })
    .join('');
}

// ========================================================
// PAGINATION PAR CURSEUR
// ========================================================

function renderPagination() {
  if (!grid) return;

  const existingPagination =
    document.getElementById(
      'documents-pagination'
    );

  existingPagination?.remove();

  /*
   * S'il n'y a qu'une seule page et qu'on est
   * sur la première page, inutile d'afficher
   * la pagination.
   */
  if (
    currentPage === 0 &&
    !hasNextPage
  ) {
    return;
  }

  const pagination =
    document.createElement('div');

  pagination.id =
    'documents-pagination';

  pagination.className =
    'col-span-full flex flex-col sm:flex-row items-center justify-between gap-3 mt-4';

  pagination.innerHTML = `
    <p class="text-xs text-gray-500">
      Page
      <span class="font-semibold text-gray-700">
        ${currentPage + 1}
      </span>
    </p>

    <div class="flex items-center gap-2">

      <button
        type="button"
        id="documents-prev"
        class="btn-secondary text-xs px-3 py-2"
        ${currentPage === 0 ? 'disabled' : ''}
      >
        ← Précédent
      </button>

      <span class="text-xs text-gray-500 px-2">
        Page ${currentPage + 1}
      </span>

      <button
        type="button"
        id="documents-next"
        class="btn-secondary text-xs px-3 py-2"
        ${!hasNextPage ? 'disabled' : ''}
      >
        Suivant →
      </button>

    </div>
  `;

  grid.appendChild(pagination);

  document
    .getElementById('documents-prev')
    ?.addEventListener(
      'click',
      () => {
        if (currentPage > 0) {
          fetchDocuments(
            currentPage - 1
          );
        }
      }
    );

  document
    .getElementById('documents-next')
    ?.addEventListener(
      'click',
      () => {
        if (hasNextPage) {
          fetchDocuments(
            currentPage + 1
          );
        }
      }
    );
}

// ========================================================
// RÉINITIALISATION DES FILTRES
// ========================================================

function resetFilters() {
  if (searchInput) {
    searchInput.value = '';
  }

  if (filterFaculty) {
    filterFaculty.value = '';
  }

  if (filterDepartment) {
    filterDepartment.value = '';
  }

  if (filterLevel) {
    filterLevel.value = '';
  }

  if (filterType) {
    filterType.value = '';
  }

  if (filterYear) {
    filterYear.value = '';
  }

  resetPagination();

  fetchDocuments(0);
}

// ========================================================
// RECHERCHE AVEC DEBOUNCE
// ========================================================

function scheduleSearch() {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    resetPagination();

    fetchDocuments(0);
  }, 300);
}

// ========================================================
// COMPTEUR DE TÉLÉCHARGEMENTS
// ========================================================

function trackDownload(docId) {
  if (!docId) return;

  supabase
    .rpc('increment_downloads', {
      doc_id: docId
    })
    .then(({ error }) => {
      if (error) {
        console.warn(
          'Impossible de mettre à jour le compteur de téléchargements :',
          error.message
        );
      }
    })
    .catch((error) => {
      console.warn(
        'Erreur lors de la mise à jour du compteur :',
        error
      );
    });
}

// ========================================================
// APERÇU PDF
// ========================================================

function openPreview(doc) {
  if (!doc || !doc.file_url) {
    return;
  }

  if (modalTitle) {
    modalTitle.textContent =
      doc.title;
  }

  if (pdfFrame) {
    pdfFrame.src =
      doc.file_url;
  }

  if (modal) {
    modal.classList.remove(
      'hidden'
    );
  }

  document.body.classList.add(
    'overflow-hidden'
  );
}

function closePreview() {
  if (modal) {
    modal.classList.add('hidden');
  }

  if (pdfFrame) {
    pdfFrame.src = '';
  }

  document.body.classList.remove(
    'overflow-hidden'
  );
}

// ========================================================
// ÉVÉNEMENTS DE LA GRILLE
// ========================================================

grid?.addEventListener(
  'click',
  (event) => {
    const previewBtn =
      event.target.closest(
        '.btn-preview'
      );

    if (previewBtn) {
      const documentId =
        previewBtn.dataset
          .previewId;

      const doc =
        currentDocuments.find(
          (item) =>
            item.id ===
            documentId
        );

      if (doc) {
        openPreview(doc);
      }

      return;
    }

    const downloadLink =
      event.target.closest(
        '.btn-download'
      );

    if (downloadLink) {
      trackDownload(
        downloadLink.dataset
          .downloadId
      );
    }
  }
);

// ========================================================
// FERMETURE MODALE
// ========================================================

closeModal?.addEventListener(
  'click',
  closePreview
);

modal?.addEventListener(
  'click',
  (event) => {
    if (event.target === modal) {
      closePreview();
    }
  }
);

document.addEventListener(
  'keydown',
  (event) => {
    if (
      event.key === 'Escape' &&
      modal &&
      !modal.classList.contains(
        'hidden'
      )
    ) {
      closePreview();
    }
  }
);

// ========================================================
// ÉVÉNEMENTS DES FILTRES
// ========================================================

searchInput?.addEventListener(
  'input',
  scheduleSearch
);

filterFaculty?.addEventListener(
  'change',
  () => {
    resetPagination();
    fetchDocuments(0);
  }
);

filterDepartment?.addEventListener(
  'change',
  () => {
    resetPagination();
    fetchDocuments(0);
  }
);

filterLevel?.addEventListener(
  'change',
  () => {
    resetPagination();
    fetchDocuments(0);
  }
);

filterType?.addEventListener(
  'change',
  () => {
    resetPagination();
    fetchDocuments(0);
  }
);

filterYear?.addEventListener(
  'change',
  () => {
    resetPagination();
    fetchDocuments(0);
  }
);

// ========================================================
// INITIALISATION
// ========================================================

async function initializeDocumentsPage() {
  applyFiltersFromUrl();

  await loadAcademicYears();

  applyFiltersFromUrl();

  resetPagination();

  await fetchDocuments(0);
}

initializeDocumentsPage();