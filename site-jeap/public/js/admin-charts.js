import { supabase } from './supabaseClient.js';

const JEAP_GREEN = '#0F3D2E';
const JEAP_ACCENT = '#F2A93B';

// --------------------------------------------------------
// Graphique 1 : Top 5 des documents les plus téléchargés
// --------------------------------------------------------
async function renderTopDownloadsChart() {
  const canvas = document.getElementById('chart-top-downloads');
  const emptyMsg = document.getElementById('chart-top-downloads-empty');
  if (!canvas || typeof Chart === 'undefined') return;

  try {
    const { data, error } = await supabase
      .from('documents')
      .select('title, downloads_count')
      .eq('status', 'published')
      .order('downloads_count', { ascending: false })
      .limit(5);

    if (error) throw error;

    const docs = (data || []).filter(d => d.downloads_count > 0);
    if (docs.length === 0) {
      canvas.classList.add('hidden');
      emptyMsg?.classList.remove('hidden');
      return;
    }

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: docs.map(d => d.title.length > 24 ? d.title.slice(0, 24) + '…' : d.title),
        datasets: [{
          label: 'Téléchargements',
          data: docs.map(d => d.downloads_count),
          backgroundColor: JEAP_ACCENT,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  } catch (err) {
    console.warn("Impossible de charger le graphique des téléchargements :", err.message);
    canvas.classList.add('hidden');
    emptyMsg?.classList.remove('hidden');
  }
}

// --------------------------------------------------------
// Graphique 2 : Inscriptions par mois (6 derniers mois)
// --------------------------------------------------------
async function renderSignupsChart() {
  const canvas = document.getElementById('chart-signups');
  const emptyMsg = document.getElementById('chart-signups-empty');
  if (!canvas || typeof Chart === 'undefined') return;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('created_at');

    if (error) throw error;

    if (!data || data.length === 0) {
      canvas.classList.add('hidden');
      emptyMsg?.classList.remove('hidden');
      return;
    }

    // Construit les 6 derniers mois (y compris le mois en cours)
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) });
    }

    const counts = Object.fromEntries(months.map(m => [m.key, 0]));
    data.forEach(profile => {
      const d = new Date(profile.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in counts) counts[key] += 1;
    });

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          label: 'Nouvelles inscriptions',
          data: months.map(m => counts[m.key]),
          backgroundColor: JEAP_GREEN,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  } catch (err) {
    console.warn("Impossible de charger le graphique des inscriptions :", err.message);
    canvas.classList.add('hidden');
    emptyMsg?.classList.remove('hidden');
  }
}

renderTopDownloadsChart();
renderSignupsChart();
