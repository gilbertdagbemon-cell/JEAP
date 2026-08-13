import { supabase } from './supabaseClient.js';
import { escapeHTML, safeUrl } from './utils.js';

// index.html affiche les 4 dernières actualités dans #news-grid.
// actualites.html affiche toutes les actualités dans #news-list.
const homeGrid = document.getElementById('news-grid');
const fullList = document.getElementById('news-list');

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Remarque sécurité : title/content viennent de la table "news", modifiable
// uniquement par un admin en théorie, mais on échappe quand même par
// précaution (défense en profondeur) avant insertion dans le HTML.
function renderHomeCards(items) {
  if (!homeGrid) return;

  if (items.length === 0) {
    homeGrid.innerHTML = `<p class="text-xs text-gray-500 col-span-full text-center py-8">Aucune actualité pour le moment.</p>`;
    return;
  }

  homeGrid.innerHTML = items.map(n => `
    <article class="border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition">
      <div class="bg-gray-100 h-28 bg-cover bg-center" style="background-image:url('${safeUrl(n.image_url)}')"></div>
      <div class="p-3">
        <p class="text-xs text-gray-500 mb-1">${escapeHTML(formatDate(n.published_at))}</p>
        <h3 class="text-xs font-semibold text-gray-800 line-clamp-2">${escapeHTML(n.title)}</h3>
      </div>
    </article>
  `).join('');
}

function renderFullList(items) {
  if (!fullList) return;

  if (items.length === 0) {
    fullList.innerHTML = `<p class="text-sm text-gray-500 col-span-full text-center py-12">Aucune actualité publiée pour le moment.</p>`;
    return;
  }

  fullList.innerHTML = items.map(n => `
    <article class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
      <div class="bg-gray-100 h-48 bg-cover bg-center" style="background-image:url('${safeUrl(n.image_url)}')"></div>
      <div class="p-4 space-y-2">
        <p class="text-xs text-gray-500">${escapeHTML(formatDate(n.published_at))}</p>
        <h3 class="text-base font-bold text-gray-800">${escapeHTML(n.title)}</h3>
        <p class="text-sm text-gray-600 line-clamp-3">${escapeHTML(n.content)}</p>
      </div>
    </article>
  `).join('');
}

async function fetchNews() {
  if (!homeGrid && !fullList) return;

  try {
    let query = supabase.from('news').select('*').order('published_at', { ascending: false });
    if (homeGrid && !fullList) {
      query = query.limit(4);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items = data || [];
    renderHomeCards(items.slice(0, 4));
    renderFullList(items);
  } catch (err) {
    const message = `<p class="text-xs text-red-500 col-span-full text-center py-8">Erreur de chargement des actualités : ${escapeHTML(err.message)}</p>`;
    if (homeGrid) homeGrid.innerHTML = message;
    if (fullList) fullList.innerHTML = message;
  }
}

fetchNews();
