import { supabase } from './supabaseClient.js';

const statDocuments = document.getElementById('stat-documents');
const statMembers = document.getElementById('stat-members');
const statFaculties = document.getElementById('stat-faculties');

// Anime un compteur de 0 jusqu'à sa valeur finale (effet "compteur qui tourne")
function animateCount(el, target) {
  if (!el) return;
  const duration = 800;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(progress * target).toLocaleString('fr-FR');
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadStats() {
  try {
    // Fonction SQL dédiée (voir supabase/migration_public_stats.sql) : elle
    // contourne la RLS de "profiles" uniquement pour renvoyer des compteurs
    // globaux, sans exposer aucune donnée personnelle.
    const { data, error } = await supabase.rpc('get_public_stats').single();
    if (error) throw error;

    animateCount(statDocuments, data.documents_count || 0);
    animateCount(statMembers, data.members_count || 0);
    animateCount(statFaculties, data.faculties_count || 0);
  } catch (err) {
    // Si la migration SQL n'a pas encore été exécutée, on masque
    // discrètement la section plutôt que d'afficher une erreur.
    console.warn("Statistiques indisponibles :", err.message);
    [statDocuments, statMembers, statFaculties].forEach(el => {
      if (el) el.textContent = '—';
    });
  }
}

loadStats();
