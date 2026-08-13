import { supabase } from './supabaseClient.js';

// Ce script est inclus sur toutes les pages. Il affiche/masque les blocs de
// navigation selon que l'utilisateur est connecté ou non, et affiche le lien
// "Admin" uniquement si le compte connecté est un administrateur validé.
//
// Convention utilisée dans le HTML :
//   - éléments avec la classe "nav-guest"      -> visibles seulement si PAS connecté
//   - éléments avec la classe "nav-user"       -> visibles seulement si connecté
//   - éléments avec la classe "nav-admin-link" -> visibles seulement si admin approuvé
//   - éléments avec la classe "btn-logout"     -> déclenchent la déconnexion au clic

function setVisible(elements, visible) {
  elements.forEach((el) => {
    el.classList.toggle('hidden', !visible);
  });
}

async function initNav() {
  const guestEls = document.querySelectorAll('.nav-guest');
  const userEls = document.querySelectorAll('.nav-user');
  const adminEls = document.querySelectorAll('.nav-admin-link');

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    setVisible(guestEls, true);
    setVisible(userEls, false);
    setVisible(adminEls, false);
    return;
  }

  // Utilisateur connecté
  setVisible(guestEls, false);
  setVisible(userEls, true);

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', session.user.id)
      .single();

    const isAdmin = profile?.role === 'admin' && profile?.status === 'approved';
    setVisible(adminEls, isAdmin);
  } catch (_err) {
    setVisible(adminEls, false);
  }
}

document.querySelectorAll('.btn-logout').forEach((btn) => {
  btn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });
});

initNav();
