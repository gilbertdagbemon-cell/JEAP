import { supabase } from './supabaseClient.js';

// Ce script alimente les pages légales (mentions-legales.html,
// confidentialite.html) avec le nom et l'email du président ACTUEL du
// bureau, à partir de la même table "bureau_members" que la page À propos
// et la page Contact. Objectif : ne plus jamais avoir à modifier ces pages
// légales à la main quand le bureau change — la composition du bureau se
// met à jour une seule fois, dans l'admin, et ces pages suivent.
//
// Si aucun membre "Président" n'est trouvé (table vide, ou aucun poste ne
// contient "président"), le texte statique déjà présent dans le HTML reste
// affiché tel quel : rien ne casse.

async function fillPresidentInfo() {
  const nameEl = document.getElementById('legal-president-name');
  const emailEls = [
    document.getElementById('legal-contact-email'),
    document.getElementById('legal-contact-email-2')
  ].filter(Boolean);

  if (!nameEl && emailEls.length === 0) return;

  try {
    const { data, error } = await supabase
      .from('bureau_members')
      .select('full_name, email, role_label')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const president = (data || []).find(m =>
      m.role_label && m.role_label.toLowerCase().includes('président')
    );

    if (!president) return; // on garde le texte statique par défaut

    if (nameEl && president.full_name) {
      nameEl.textContent = president.full_name;
    }

    if (president.email) {
      emailEls.forEach(el => {
        el.textContent = president.email;
        el.setAttribute('href', `mailto:${president.email}`);
      });
    }
  } catch (err) {
    // Erreur silencieuse : le texte statique par défaut reste affiché,
    // pas d'impact sur la lisibilité de la page légale.
    console.error('Chargement des infos du président : ', err.message);
  }
}

fillPresidentInfo();
