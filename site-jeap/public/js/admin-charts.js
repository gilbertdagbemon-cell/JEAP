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

    const docs = (data || []).filter(
      (document) => Number(document.downloads_count) > 0
    );

    if (docs.length === 0) {
      canvas.classList.add('hidden');
      emptyMsg?.classList.remove('hidden');
      return;
    }

    canvas.classList.remove('hidden');
    emptyMsg?.classList.add('hidden');

    new Chart(canvas, {
      type: 'bar',

      data: {
        labels: docs.map((document) => {
          const title = document.title || 'Document sans titre';

          return title.length > 24
            ? `${title.slice(0, 24)}…`
            : title;
        }),

        datasets: [
          {
            label: 'Téléchargements',

            data: docs.map((document) =>
              Number(document.downloads_count) || 0
            ),

            backgroundColor: JEAP_ACCENT,
            borderRadius: 4
          }
        ]
      },

      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: false
          }
        },

        scales: {
          x: {
            beginAtZero: true,

            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  } catch (err) {
    console.warn(
      'Impossible de charger le graphique des téléchargements :',
      err.message
    );

    canvas.classList.add('hidden');
    emptyMsg?.classList.remove('hidden');
  }
}

// --------------------------------------------------------
// Graphique 2 : Inscriptions par mois
// Les statistiques sont calculées directement par PostgreSQL
// --------------------------------------------------------
async function renderSignupsChart() {
  const canvas = document.getElementById('chart-signups');
  const emptyMsg = document.getElementById('chart-signups-empty');

  if (!canvas || typeof Chart === 'undefined') return;

  try {
    const { data, error } = await supabase.rpc(
      'get_signup_stats'
    );

    if (error) throw error;

    const stats = data || [];

    /*
     * La fonction SQL renvoie uniquement les mois ayant
     * des inscriptions. Nous reconstruisons ici les
     * 6 derniers mois afin d'afficher également les mois
     * avec 0 inscription.
     */
    const now = new Date();
    const months = [];

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1
      );

      const year = date.getFullYear();
      const month = date.getMonth();

      months.push({
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('fr-FR', {
          month: 'short',
          year: '2-digit'
        })
      });
    }

    const counts = Object.fromEntries(
      months.map((month) => [month.key, 0])
    );

    stats.forEach((item) => {
      if (!item.month_start) return;

      /*
       * month_start est renvoyé par PostgreSQL au format :
       * YYYY-MM-DD
       */
      const monthKey = item.month_start.slice(0, 7);

      if (monthKey in counts) {
        counts[monthKey] =
          Number(item.signup_count) || 0;
      }
    });

    const totalSignups = Object.values(counts).reduce(
      (total, count) => total + count,
      0
    );

    if (stats.length === 0 || totalSignups === 0) {
      canvas.classList.add('hidden');
      emptyMsg?.classList.remove('hidden');
      return;
    }

    canvas.classList.remove('hidden');
    emptyMsg?.classList.add('hidden');

    new Chart(canvas, {
      type: 'bar',

      data: {
        labels: months.map(
          (month) => month.label
        ),

        datasets: [
          {
            label: 'Nouvelles inscriptions',

            data: months.map(
              (month) => counts[month.key]
            ),

            backgroundColor: JEAP_GREEN,
            borderRadius: 4
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: false
          }
        },

        scales: {
          y: {
            beginAtZero: true,

            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  } catch (err) {
    console.warn(
      'Impossible de charger le graphique des inscriptions :',
      err.message
    );

    canvas.classList.add('hidden');
    emptyMsg?.classList.remove('hidden');
  }
}

// --------------------------------------------------------
// Initialisation des graphiques
// --------------------------------------------------------
renderTopDownloadsChart();
renderSignupsChart();