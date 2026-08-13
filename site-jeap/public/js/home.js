import { supabase } from './supabaseClient.js';
import { escapeHTML } from './utils.js';

const grid = document.getElementById('faculties-grid');

// Charger la liste des facultés/écoles depuis Supabase
async function fetchFaculties() {
  if (!grid) return;

  try {
    const { data, error } = await supabase
      .from('faculties')
      .select('id, code, name, type')
      .order('name', { ascending: true });

    if (error) throw error;

    renderFaculties(data || []);
  } catch (err) {
    grid.innerHTML = `<p class="text-xs text-red-500 col-span-full text-center py-8">Erreur de chargement des facultés : ${err.message}</p>`;
  }
}

// Afficher les cartes de facultés (remplace les squelettes de chargement)
function renderFaculties(faculties) {
  if (faculties.length === 0) {
    grid.innerHTML = `<p class="text-xs text-gray-500 col-span-full text-center py-8">Aucune faculté trouvée.</p>`;
    return;
  }

  grid.innerHTML = faculties.map(f => `
    <a href="pages/documents.html?faculty=${encodeURIComponent(f.code)}"
       class="bg-white rounded-lg shadow-sm p-4 min-h-[5rem] flex flex-col justify-center hover:shadow-md transition border border-gray-100">
      <span class="text-xs font-bold uppercase text-jeap-accent-dark">${escapeHTML(f.code)}</span>
      <span class="text-xs text-gray-600 mt-1">${escapeHTML(f.name)}</span>
    </a>
  `).join('');
}

fetchFaculties();