```js
import { supabase } from './supabaseClient.js';
import { escapeHTML, safeUrl } from './utils.js';

// index.html affiche les 4 dernières actualités dans #news-grid.
// actualites.html affiche toutes les actualités dans #news-list.
const homeGrid = document.getElementById('news-grid');
const fullList = document.getElementById('news-list');

// Éléments de la fenêtre modale "actualité en entier"
const modal = document.getElementById('news-modal');
const modalImage = document.getElementById('modal-news-image');
const modalDate = document.getElementById('modal-news-date');
const modalTitle = document.getElementById('modal-news-title');
const modalContent = document.getElementById('modal-news-content');
const closeModalBtn = document.getElementById('close-news-modal');

// Garde les actualités chargées en mémoire pour pouvoir les réafficher en entier au clic
let newsItems = [];

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function renderHomeCards(items) {
  if (!homeGrid) return;

  if (items.length === 0) {
    homeGrid.innerHTML = `
      <p class="text-xs text-gray-500 col-span-full text-center py-8">
        Aucune actualité pour le moment.
      </p>
    `;
    return;
  }

  homeGrid.innerHTML = items.map(n => `
    <article class="border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition bg-white">
      <div
        class="bg-gray-100 h-28 bg-cover bg-center"
        style="background-image:url('${safeUrl(n.image_url)}')"
      ></div>

      <div class="p-3">
        <p class="text-xs text-gray-500 mb-1">
          ${escapeHTML(formatDate(n.published_at))}
        </p>

        <h3 class="text-xs font-semibold text-gray-800 line-clamp-2">
          ${escapeHTML(n.title)}
        </h3>
      </div>
    </article>
  `).join('');
}

function renderFullList(items) {
  if (!fullList) return;

  if (items.length === 0) {
    fullList.innerHTML = `
      <p class="text-sm text-gray-500 col-span-full text-center py-12">
        Aucune actualité publiée pour le moment.
      </p>
    `;
    return;
  }

  fullList.innerHTML = items.map(n => `
    <article
      data-news-id="${escapeHTML(String(n.id))}"
      class="news-card cursor-pointer bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition"
    >
      <div
        class="bg-gray-100 h-48 bg-cover bg-center"
        style="background-image:url('${safeUrl(n.image_url)}')"
      ></div>

      <div class="p-4 space-y-2">
        <p class="text-xs text-gray-500">
          ${escapeHTML(formatDate(n.published_at))}
        </p>

        <h3 class="text-base font-bold text-gray-800">
          ${escapeHTML(n.title)}
        </h3>

        <p class="text-sm text-gray-600 line-clamp-3">
          ${escapeHTML(n.content)}
        </p>

        <button
          type="button"
          class="btn-read-more text-xs font-semibold text-jeap-accent-dark hover:underline mt-2 inline-block"
          data-news-id="${escapeHTML(String(n.id))}"
        >
          Lire la suite →
        </button>
      </div>
    </article>
  `).join('');
}

// Ouvre la fenêtre modale avec le texte complet et bien structuré
function openNewsModal(item) {
  if (!modal || !item) return;

  // Remplit l'image
  modalImage.style.backgroundImage =
    `url('${safeUrl(item.image_url)}')`;

  // Remplit la date
  modalDate.textContent =
    formatDate(item.published_at);

  // Remplit le titre
  modalTitle.textContent =
    item.title;

  // Découpe le contenu en paragraphes
  const paragraphs = item.content
    .split('\n')
    .filter(p => p.trim() !== '')
    .map(
      p => `<p class="leading-relaxed">${escapeHTML(p)}</p>`
    )
    .join('');

  // Insère le contenu
  modalContent.innerHTML =
    paragraphs ||
    `<p>${escapeHTML(item.content)}</p>`;

  // Affiche la modale
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  // Empêche uniquement la page située derrière la modale de défiler
  document.body.classList.add('overflow-hidden');

  // Réinitialise la position de défilement de la zone
  // scrollable à chaque nouvelle ouverture.
  const scrollContainer = modalContent.parentElement;

  if (scrollContainer) {
    scrollContainer.scrollTop = 0;
  }
}

// Ferme la fenêtre modale
function closeNewsModal() {
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');

  // Réactive le défilement de la page
  document.body.classList.remove('overflow-hidden');
}

// Délégation d'événements pour l'ouverture au clic sur une carte
if (fullList) {
  fullList.addEventListener('click', (e) => {
    const card = e.target.closest('[data-news-id]');

    if (!card) return;

    const item = newsItems.find(
      n => String(n.id) === card.dataset.newsId
    );

    openNewsModal(item);
  });
}

// Bouton de fermeture
if (closeModalBtn) {
  closeModalBtn.addEventListener(
    'click',
    closeNewsModal
  );
}

// Fermeture en cliquant sur l'arrière-plan
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeNewsModal();
    }
  });
}

// Fermeture avec la touche Échap
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeNewsModal();
  }
});

// Récupération des actualités depuis Supabase
async function fetchNews() {
  if (!homeGrid && !fullList) return;

  try {
    let query = supabase
      .from('news')
      .select('*')
      .order('published_at', {
        ascending: false
      });

    if (homeGrid && !fullList) {
      query = query.limit(4);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const items = data || [];

    newsItems = items;

    renderHomeCards(
      items.slice(0, 4)
    );

    renderFullList(items);

  } catch (err) {

    const message = `
      <p class="text-xs text-red-500 col-span-full text-center py-8">
        Erreur de chargement des actualités :
        ${escapeHTML(err.message)}
      </p>
    `;

    if (homeGrid) {
      homeGrid.innerHTML = message;
    }

    if (fullList) {
      fullList.innerHTML = message;
    }
  }
}

fetchNews();
```
