import { supabase } from './supabaseClient.js';
import { escapeHTML } from './utils.js';

const usersTable = document.getElementById('users-table');
const docsTable = document.getElementById('docs-table');
const adminGuardMsg = document.getElementById('admin-guard-message');
const adminContent = document.getElementById('admin-content');

// Section bureau exécutif
const bureauTable = document.getElementById('bureau-table');
const bureauForm = document.getElementById('bureau-form');
const bureauIdField = document.getElementById('bureau-id');
const bureauFullNameField = document.getElementById('bureau-full-name');
const bureauRoleField = document.getElementById('bureau-role');
const bureauEmailField = document.getElementById('bureau-email');
const bureauWhatsappField = document.getElementById('bureau-whatsapp');
const bureauFacebookUrlField = document.getElementById('bureau-facebook-url');
const bureauFacebookLabelField = document.getElementById('bureau-facebook-label');
const bureauYearField = document.getElementById('bureau-year');
const bureauSortOrderField = document.getElementById('bureau-sort-order');
const bureauPhotoField = document.getElementById('bureau-photo');
const bureauFormTitle = document.getElementById('bureau-form-title');
const bureauFormAlert = document.getElementById('bureau-form-alert');
const bureauSubmitBtn = document.getElementById('bureau-submit-btn');
const bureauCancelEditBtn = document.getElementById('bureau-cancel-edit');

let latestBureauItems = [];

// Section actualités
const newsTable = document.getElementById('news-table');
const newsForm = document.getElementById('news-form');
const newsIdField = document.getElementById('news-id');
const newsTitleField = document.getElementById('news-title');
const newsContentField = document.getElementById('news-content');
const newsImageField = document.getElementById('news-image');
const newsFormTitle = document.getElementById('news-form-title');
const newsFormAlert = document.getElementById('news-form-alert');
const newsSubmitBtn = document.getElementById('news-submit-btn');
const newsCancelEditBtn = document.getElementById('news-cancel-edit');

// Garde en mémoire les dernières actualités chargées, pour retrouver l'objet
// complet au clic sur "Modifier" sans avoir à le repasser en JSON dans un
// attribut onclick (source de bugs et de failles XSS).
let latestNewsItems = [];

// Vérifie que l'utilisateur connecté est bien admin (role = 'admin' ET status = 'approved')
// avant d'afficher le contenu de la page. Sinon, redirige.
async function checkAdminAccess() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.href = 'connexion.html';
    return false;
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .single();

  if (error || !profile || profile.role !== 'admin' || profile.status !== 'approved') {
    if (adminGuardMsg) {
      adminGuardMsg.textContent = "Accès refusé : cette page est réservée aux administrateurs.";
      adminGuardMsg.classList.remove('hidden');
    }
    if (adminContent) adminContent.classList.add('hidden');
    return false;
  }

  if (adminContent) adminContent.classList.remove('hidden');
  return true;
}

// Traduction lisible du statut (enum: pending / approved / rejected)
function statusBadge(status) {
  const map = {
    approved: { label: 'Validé', cls: 'bg-green-100 text-green-700' },
    pending: { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700' },
    rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' }
  };
  return map[status] || map.pending;
}

// Charger la liste des utilisateurs
// Remarque sécurité : first_name/last_name/email sont saisis librement par
// n'importe quel visiteur lors de l'inscription. Sans escapeHTML(), un nom
// contenant du code (ex. "<img src=x onerror=...>") s'exécuterait dans le
// navigateur de l'admin qui consulte cette page (faille XSS ciblant l'admin).
async function loadUsers() {
  if (!usersTable) return;

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      usersTable.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Aucun utilisateur trouvé.</td></tr>`;
      return;
    }

    // On récupère l'utilisateur connecté pour l'empêcher de se rétrograder
    // lui-même par erreur (sinon il perdrait l'accès au panneau admin).
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    usersTable.innerHTML = profiles.map(user => {
      const badge = statusBadge(user.status);
      const isAdminRole = user.role === 'admin';
      const isSelf = currentUser && currentUser.id === user.id;

      return `
      <tr>
        <td class="p-3 font-semibold">${escapeHTML(user.first_name || '')} ${escapeHTML(user.last_name || '')}</td>
        <td class="p-3 text-gray-600">${escapeHTML(user.email || 'N/A')}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-xs font-bold ${badge.cls}">
            ${badge.label}
          </span>
        </td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-xs font-bold ${isAdminRole ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}">
            ${isAdminRole ? 'Admin' : 'Membre'}
          </span>
        </td>
        <td class="p-3 text-right space-x-2 whitespace-nowrap">
          ${user.status !== 'approved' ? `
            <button data-user-id="${escapeHTML(user.id)}" data-user-action="approved" class="btn-user-status btn-cta text-xs py-1 px-2">Valider</button>
          ` : `
            <button data-user-id="${escapeHTML(user.id)}" data-user-action="rejected" class="btn-user-status btn-secondary text-xs py-1 px-2">Bloquer</button>
          `}
          ${!isAdminRole ? `
            <button data-user-id="${escapeHTML(user.id)}" data-user-role="admin" class="btn-user-role btn-secondary text-xs py-1 px-2">Nommer admin</button>
          ` : (isSelf ? '' : `
            <button data-user-id="${escapeHTML(user.id)}" data-user-role="student" class="btn-user-role btn-secondary text-xs py-1 px-2">Retirer admin</button>
          `)}
        </td>
      </tr>
    `;
    }).join('');
  } catch (err) {
    usersTable.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erreur : ${escapeHTML(err.message)}</td></tr>`;
  }
}

usersTable?.addEventListener('click', (e) => {
  const statusBtn = e.target.closest('.btn-user-status');
  if (statusBtn) {
    toggleUserStatus(statusBtn.dataset.userId, statusBtn.dataset.userAction);
    return;
  }

  const roleBtn = e.target.closest('.btn-user-role');
  if (roleBtn) {
    const promoting = roleBtn.dataset.userRole === 'admin';
    const confirmMsg = promoting
      ? "Nommer cet utilisateur administrateur ? Il aura alors un accès total au site."
      : "Retirer les droits administrateur de cet utilisateur ?";
    if (!confirm(confirmMsg)) return;
    toggleUserRole(roleBtn.dataset.userId, roleBtn.dataset.userRole);
  }
});

// Charger la liste des documents pour la suppression/modération
async function loadDocs() {
  if (!docsTable) return;

  try {
    const { data: docs, error } = await supabase
      .from('documents')
      .select(`
        *,
        faculties ( code ),
        levels ( code )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!docs || docs.length === 0) {
      docsTable.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Aucun document.</td></tr>`;
      return;
    }

    docsTable.innerHTML = docs.map(doc => `
      <tr>
        <td class="p-3 font-semibold text-gray-800">${escapeHTML(doc.title)}</td>
        <td class="p-3 text-gray-500">${escapeHTML(doc.faculties?.code || 'N/A')} - ${escapeHTML(doc.levels?.code || '')}</td>
        <td class="p-3 text-gray-500">${escapeHTML(new Date(doc.created_at).toLocaleDateString())}</td>
        <td class="p-3 text-right">
          <button data-doc-id="${escapeHTML(doc.id)}" class="btn-delete-doc text-red-600 hover:underline font-semibold text-xs">Supprimer</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    docsTable.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Erreur : ${escapeHTML(err.message)}</td></tr>`;
  }
}

docsTable?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete-doc');
  if (!btn) return;
  deleteDoc(btn.dataset.docId);
});

// --------------------------------------------------------
// Gestion des actualités
// --------------------------------------------------------

function newsFormAlertShow(message, isError = false) {
  if (!newsFormAlert) return;
  newsFormAlert.textContent = message;
  newsFormAlert.className = `mb-4 p-3 text-xs rounded-md ${isError ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`;
  newsFormAlert.classList.remove('hidden');
}

// Charge la liste des actualités déjà publiées
async function loadNews() {
  if (!newsTable) return;

  try {
    const { data: news, error } = await supabase
      .from('news')
      .select('*')
      .order('published_at', { ascending: false });

    if (error) throw error;

    latestNewsItems = news || [];

    if (latestNewsItems.length === 0) {
      newsTable.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">Aucune actualité publiée.</td></tr>`;
      return;
    }

    newsTable.innerHTML = latestNewsItems.map(item => `
      <tr>
        <td class="p-3 font-semibold text-gray-800">${escapeHTML(item.title)}</td>
        <td class="p-3 text-gray-500">${escapeHTML(new Date(item.published_at).toLocaleDateString())}</td>
        <td class="p-3 text-right space-x-3">
          <button data-news-id="${escapeHTML(item.id)}" class="btn-edit-news text-jeap-accent-dark hover:underline font-semibold text-xs">Modifier</button>
          <button data-news-id="${escapeHTML(item.id)}" class="btn-delete-news text-red-600 hover:underline font-semibold text-xs">Supprimer</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    newsTable.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Erreur : ${escapeHTML(err.message)}</td></tr>`;
  }
}

newsTable?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.btn-edit-news');
  if (editBtn) {
    const item = latestNewsItems.find(n => n.id === editBtn.dataset.newsId);
    if (item) editNews(item);
    return;
  }

  const deleteBtn = e.target.closest('.btn-delete-news');
  if (deleteBtn) {
    deleteNews(deleteBtn.dataset.newsId);
  }
});

// Pré-remplit le formulaire pour modifier une actualité existante
// (utilise .value / textContent : pas de HTML interprété, donc pas besoin d'escapeHTML ici)
function editNews(item) {
  if (!newsForm) return;
  newsIdField.value = item.id;
  newsTitleField.value = item.title;
  newsContentField.value = item.content;
  if (newsFormTitle) newsFormTitle.textContent = "Modifier l'actualité";
  if (newsSubmitBtn) newsSubmitBtn.textContent = "Enregistrer les modifications";
  if (newsCancelEditBtn) newsCancelEditBtn.classList.remove('hidden');
  newsForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Réinitialise le formulaire (mode création)
function resetNewsForm() {
  if (!newsForm) return;
  newsForm.reset();
  newsIdField.value = '';
  if (newsFormTitle) newsFormTitle.textContent = "Publier une actualité";
  if (newsSubmitBtn) newsSubmitBtn.textContent = "Publier";
  if (newsCancelEditBtn) newsCancelEditBtn.classList.add('hidden');
}

newsCancelEditBtn?.addEventListener('click', resetNewsForm);

// Création ou mise à jour d'une actualité
if (newsForm) {
  newsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = newsIdField.value;
    const title = newsTitleField.value.trim();
    const content = newsContentField.value.trim();
    const file = newsImageField?.files?.[0];

    if (!title || !content) {
      newsFormAlertShow("Merci de remplir le titre et le contenu.", true);
      return;
    }

    newsSubmitBtn.disabled = true;

    try {
      let image_url;

      // Upload de l'image de couverture si l'admin en a choisi une (facultatif)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `news/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('jeap-docs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('jeap-docs').getPublicUrl(filePath);
        image_url = publicUrlData.publicUrl;
      }

      if (id) {
        // Mise à jour d'une actualité existante
        const updatePayload = { title, content };
        if (image_url) updatePayload.image_url = image_url;

        const { error } = await supabase.from('news').update(updatePayload).eq('id', id);
        if (error) throw error;
        newsFormAlertShow("Actualité mise à jour avec succès.");
      } else {
        // Création d'une nouvelle actualité
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('news').insert([
          { title, content, image_url: image_url || null, author_id: user?.id }
        ]);
        if (error) throw error;
        newsFormAlertShow("Actualité publiée avec succès.");
      }

      resetNewsForm();
      loadNews();
    } catch (err) {
      newsFormAlertShow("Erreur : " + err.message, true);
    } finally {
      newsSubmitBtn.disabled = false;
    }
  });
}

async function deleteNews(newsId) {
  if (!confirm("Voulez-vous vraiment supprimer cette actualité ?")) return;

  const { error } = await supabase.from('news').delete().eq('id', newsId);

  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
  } else {
    loadNews();
  }
}

// --------------------------------------------------------
// Gestion du bureau exécutif
// --------------------------------------------------------

function bureauFormAlertShow(message, isError = false) {
  if (!bureauFormAlert) return;
  bureauFormAlert.textContent = message;
  bureauFormAlert.className = `mb-4 p-3 text-xs rounded-md ${isError ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`;
  bureauFormAlert.classList.remove('hidden');
}

// Charge la liste des membres du bureau (actifs et inactifs, pour permettre
// à l'admin de tout gérer depuis un seul endroit)
async function loadBureau() {
  if (!bureauTable) return;

  try {
    const { data: members, error } = await supabase
      .from('bureau_members')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    latestBureauItems = members || [];

    if (latestBureauItems.length === 0) {
      bureauTable.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">Aucun membre enregistré.</td></tr>`;
      return;
    }

    bureauTable.innerHTML = latestBureauItems.map(m => `
      <tr>
        <td class="p-3">
          <div class="w-8 h-8 rounded-full bg-jeap-bg overflow-hidden flex items-center justify-center text-sm">
            ${m.photo_url ? `<img src="${escapeHTML(m.photo_url)}" alt="" class="w-full h-full object-cover">` : '👤'}
          </div>
        </td>
        <td class="p-3 font-semibold text-gray-800">${escapeHTML(m.full_name)}${m.is_active === false ? ' <span class="text-gray-400">(masqué)</span>' : ''}</td>
        <td class="p-3 text-gray-500">${escapeHTML(m.role_label)}</td>
        <td class="p-3 text-gray-500">${escapeHTML(m.academic_year)}</td>
        <td class="p-3 text-right space-x-3 whitespace-nowrap">
          <button data-bureau-id="${escapeHTML(m.id)}" class="btn-edit-bureau text-jeap-accent-dark hover:underline font-semibold text-xs">Modifier</button>
          <button data-bureau-id="${escapeHTML(m.id)}" class="btn-delete-bureau text-red-600 hover:underline font-semibold text-xs">Supprimer</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    bureauTable.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Erreur : ${escapeHTML(err.message)}</td></tr>`;
  }
}

bureauTable?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.btn-edit-bureau');
  if (editBtn) {
    const item = latestBureauItems.find(m => m.id === editBtn.dataset.bureauId);
    if (item) editBureau(item);
    return;
  }

  const deleteBtn = e.target.closest('.btn-delete-bureau');
  if (deleteBtn) {
    deleteBureau(deleteBtn.dataset.bureauId);
  }
});

// Pré-remplit le formulaire pour modifier un membre existant
// (utilise .value : pas de HTML interprété, pas besoin d'escapeHTML ici)
function editBureau(item) {
  if (!bureauForm) return;
  bureauIdField.value = item.id;
  bureauFullNameField.value = item.full_name || '';
  bureauRoleField.value = item.role_label || '';
  bureauEmailField.value = item.email || '';
  bureauWhatsappField.value = item.whatsapp_phone || '';
  bureauFacebookUrlField.value = item.facebook_url || '';
  bureauFacebookLabelField.value = item.facebook_label || '';
  bureauYearField.value = item.academic_year || '';
  bureauSortOrderField.value = item.sort_order ?? 0;
  if (bureauFormTitle) bureauFormTitle.textContent = "Modifier un membre du bureau";
  if (bureauSubmitBtn) bureauSubmitBtn.textContent = "Enregistrer les modifications";
  if (bureauCancelEditBtn) bureauCancelEditBtn.classList.remove('hidden');
  bureauForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Réinitialise le formulaire (mode création)
function resetBureauForm() {
  if (!bureauForm) return;
  bureauForm.reset();
  bureauIdField.value = '';
  bureauSortOrderField.value = 0;
  if (bureauFormTitle) bureauFormTitle.textContent = "Ajouter un membre du bureau";
  if (bureauSubmitBtn) bureauSubmitBtn.textContent = "Ajouter";
  if (bureauCancelEditBtn) bureauCancelEditBtn.classList.add('hidden');
}

bureauCancelEditBtn?.addEventListener('click', resetBureauForm);

// Création ou mise à jour d'un membre du bureau
if (bureauForm) {
  bureauForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = bureauIdField.value;
    const full_name = bureauFullNameField.value.trim();
    const role_label = bureauRoleField.value.trim();
    const email = bureauEmailField.value.trim();
    const whatsapp_phone = bureauWhatsappField.value.trim().replace(/\D/g, ''); // ne garde que les chiffres
    const facebook_url = bureauFacebookUrlField.value.trim();
    const facebook_label = bureauFacebookLabelField.value.trim();
    const academic_year = bureauYearField.value.trim();
    const sort_order = parseInt(bureauSortOrderField.value, 10) || 0;
    const file = bureauPhotoField?.files?.[0];

    if (!full_name || !role_label || !academic_year) {
      bureauFormAlertShow("Merci de remplir au minimum le nom, le poste et l'année académique.", true);
      return;
    }

    bureauSubmitBtn.disabled = true;

    try {
      let photo_url;

      // Upload de la photo si l'admin en a choisi une (facultatif)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `bureau/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('jeap-docs')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('jeap-docs').getPublicUrl(filePath);
        photo_url = publicUrlData.publicUrl;
      }

      const payload = {
        full_name,
        role_label,
        email: email || null,
        whatsapp_phone: whatsapp_phone || null,
        facebook_url: facebook_url || null,
        facebook_label: facebook_label || null,
        academic_year,
        sort_order
      };
      if (photo_url) payload.photo_url = photo_url;

      if (id) {
        const { error } = await supabase.from('bureau_members').update(payload).eq('id', id);
        if (error) throw error;
        bureauFormAlertShow("Membre mis à jour avec succès.");
      } else {
        const { error } = await supabase.from('bureau_members').insert([payload]);
        if (error) throw error;
        bureauFormAlertShow("Membre ajouté avec succès.");
      }

      resetBureauForm();
      loadBureau();
    } catch (err) {
      bureauFormAlertShow("Erreur : " + err.message, true);
    } finally {
      bureauSubmitBtn.disabled = false;
    }
  });
}

async function deleteBureau(bureauId) {
  if (!confirm("Voulez-vous vraiment retirer ce membre du bureau ?")) return;

  const { error } = await supabase.from('bureau_members').delete().eq('id', bureauId);

  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
  } else {
    loadBureau();
  }
}

// Actions globales
async function toggleUserStatus(userId, newStatus) {
  const { error } = await supabase
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', userId);

  if (error) {
    alert("Erreur lors de la mise à jour : " + error.message);
  } else {
    loadUsers();
  }
}

// Nomme ou retire un rôle administrateur. Autorisé côté base par la policy
// RLS "Mise à jour profil propre utilisateur" (auth.uid() = id OR is_admin()) :
// seul un admin déjà approuvé peut changer le rôle d'un autre profil.
async function toggleUserRole(userId, newRole) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId);

  if (error) {
    alert("Erreur lors de la mise à jour du rôle : " + error.message);
  } else {
    loadUsers();
  }
}

async function deleteDoc(docId) {
  if (!confirm("Voulez-vous vraiment supprimer ce document ?")) return;

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', docId);

  if (error) {
    alert("Erreur lors de la suppression : " + error.message);
  } else {
    loadDocs();
  }
}

// Initialisation : on vérifie d'abord les droits admin, puis on charge les données
(async () => {
  const isAdmin = await checkAdminAccess();
  if (isAdmin) {
    loadUsers();
    loadDocs();
    loadNews();
    loadBureau();
  }
})();
