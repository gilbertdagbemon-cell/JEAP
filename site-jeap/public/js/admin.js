import { supabase } from './supabaseClient.js';
import { escapeHTML } from './utils.js';

const usersTable = document.getElementById('users-table');
const docsTable = document.getElementById('docs-table');
const adminGuardMsg = document.getElementById('admin-guard-message');
const adminContent = document.getElementById('admin-content');

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

let latestNewsItems = [];
let currentUserId = null;

const PAGE_SIZES = {
  users: 15,
  docs: 15,
  news: 10
};

const paginationState = {
  users: { page: 0, requestId: 0, cursors: [null], hasNext: false },
  docs: { page: 0, requestId: 0, cursors: [null], hasNext: false },
  news: { page: 0, requestId: 0, cursors: [null], hasNext: false }
};

function resetPagination(type) {
  paginationState[type].page = 0;
  paginationState[type].cursors = [null];
  paginationState[type].hasNext = false;
}

function ensurePaginationElement(table, type) {
  if (!table) return null;

  const id = `${type}-pagination`;
  let container = document.getElementById(id);

  if (container) return container;

  const overflowContainer = table.closest('.overflow-x-auto');

  if (!overflowContainer) return null;

  container = document.createElement('div');
  container.id = id;
  container.className = 'mt-4 flex flex-col sm:flex-row items-center justify-between gap-3';

  overflowContainer.insertAdjacentElement('afterend', container);

  return container;
}

function renderPagination(type, table) {
  const container = ensurePaginationElement(table, type);

  if (!container) return;

  const state = paginationState[type];

  if (state.page === 0 && !state.hasNext) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <span class="text-xs text-gray-500">
      Page <span class="font-semibold text-gray-700">${state.page + 1}</span>
    </span>

    <div class="flex items-center gap-2">
      <button
        type="button"
        data-pagination-type="${type}"
        data-pagination-page="${state.page - 1}"
        class="btn-pagination btn-secondary text-xs py-1.5 px-3 ${state.page === 0 ? 'opacity-50 cursor-not-allowed' : ''}"
        ${state.page === 0 ? 'disabled' : ''}
      >
        Précédent
      </button>

      <span class="text-xs font-semibold text-gray-600">
        Page ${state.page + 1}
      </span>

      <button
        type="button"
        data-pagination-type="${type}"
        data-pagination-page="${state.page + 1}"
        class="btn-pagination btn-secondary text-xs py-1.5 px-3 ${!state.hasNext ? 'opacity-50 cursor-not-allowed' : ''}"
        ${!state.hasNext ? 'disabled' : ''}
      >
        Suivant
      </button>
    </div>
  `;
}

function bindPaginationEvents() {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-pagination');

    if (!button || button.disabled) return;

    const type = button.dataset.paginationType;
    const page = Number(button.dataset.paginationPage);
    const state = paginationState[type];

    if (!state || !Number.isInteger(page) || page < 0) return;

    state.page = page;

    if (type === 'users') loadUsers();
    if (type === 'docs') loadDocs();
    if (type === 'news') loadNews();
  });
}

function applyCursor(request, cursor) {
  if (!cursor) return request;

  return request.or(
    `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
  );
}

function applyNewsCursor(request, cursor) {
  if (!cursor) return request;

  return request.or(
    `published_at.lt.${cursor.published_at},and(published_at.eq.${cursor.published_at},id.lt.${cursor.id})`
  );
}

async function checkAdminAccess() {
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    window.location.href = 'connexion.html';
    return false;
  }

  currentUserId = user.id;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (
    error ||
    !profile ||
    profile.role !== 'admin' ||
    profile.status !== 'approved'
  ) {
    if (adminGuardMsg) {
      adminGuardMsg.textContent =
        'Accès refusé : cette page est réservée aux administrateurs.';
      adminGuardMsg.classList.remove('hidden');
    }

    if (adminContent) {
      adminContent.classList.add('hidden');
    }

    return false;
  }

  if (adminContent) {
    adminContent.classList.remove('hidden');
  }

  return true;
}

function statusBadge(status) {
  const map = {
    approved: {
      label: 'Validé',
      cls: 'bg-green-100 text-green-700'
    },
    pending: {
      label: 'En attente',
      cls: 'bg-yellow-100 text-yellow-700'
    },
    rejected: {
      label: 'Rejeté',
      cls: 'bg-red-100 text-red-700'
    }
  };

  return map[status] || map.pending;
}

async function loadUsers() {
  if (!usersTable) return;

  const requestId = ++paginationState.users.requestId;
  const state = paginationState.users;
  const cursor = state.cursors[state.page] || null;

  usersTable.innerHTML = `
    <tr>
      <td colspan="5" class="p-4 text-center text-gray-500">
        Chargement des utilisateurs...
      </td>
    </tr>
  `;

  try {
    let request = supabase
      .from('profiles')
      .select(
        'id, first_name, last_name, email, role, status, created_at'
      )
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZES.users + 1);

    request = applyCursor(request, cursor);

    const {
      data: rawProfiles,
      error
    } = await request;

    if (requestId !== paginationState.users.requestId) return;

    if (error) throw error;

    state.hasNext =
      (rawProfiles || []).length > PAGE_SIZES.users;

    const profiles = (rawProfiles || []).slice(
      0,
      PAGE_SIZES.users
    );

    if (state.hasNext && profiles.length > 0) {
      const last = profiles[profiles.length - 1];

      state.cursors[state.page + 1] = {
        created_at: last.created_at,
        id: last.id
      };
    } else {
      state.cursors.length = state.page + 1;
    }

    if (!profiles || profiles.length === 0) {
      usersTable.innerHTML = `
        <tr>
          <td colspan="5" class="p-4 text-center text-gray-500">
            Aucun utilisateur trouvé.
          </td>
        </tr>
      `;

      renderPagination('users', usersTable);
      return;
    }

    usersTable.innerHTML = profiles
      .map((user) => {
        const badge = statusBadge(user.status);
        const isAdminRole = user.role === 'admin';
        const isSelf = currentUserId === user.id;

        return `
          <tr>
            <td class="p-3 font-semibold">
              ${escapeHTML(user.first_name || '')}
              ${escapeHTML(user.last_name || '')}
            </td>

            <td class="p-3 text-gray-600">
              ${escapeHTML(user.email || 'N/A')}
            </td>

            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${badge.cls}">
                ${badge.label}
              </span>
            </td>

            <td class="p-3">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${
                isAdminRole
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
              }">
                ${isAdminRole ? 'Admin' : 'Membre'}
              </span>
            </td>

            <td class="p-3 text-right space-x-2 whitespace-nowrap">
              ${
                user.status !== 'approved'
                  ? `
                    <button
                      data-user-id="${escapeHTML(user.id)}"
                      data-user-action="approved"
                      class="btn-user-status btn-cta text-xs py-1 px-2"
                    >
                      Valider
                    </button>
                  `
                  : `
                    ${
                      isSelf
                        ? ''
                        : `
                          <button
                            data-user-id="${escapeHTML(user.id)}"
                            data-user-action="rejected"
                            class="btn-user-status btn-secondary text-xs py-1 px-2"
                          >
                            Bloquer
                          </button>
                        `
                    }
                  `
              }

              ${
                !isAdminRole
                  ? `
                    <button
                      data-user-id="${escapeHTML(user.id)}"
                      data-user-role="admin"
                      class="btn-user-role btn-secondary text-xs py-1 px-2"
                    >
                      Nommer admin
                    </button>
                  `
                  : `
                    ${
                      isSelf
                        ? ''
                        : `
                          <button
                            data-user-id="${escapeHTML(user.id)}"
                            data-user-role="student"
                            class="btn-user-role btn-secondary text-xs py-1 px-2"
                          >
                            Retirer admin
                          </button>
                        `
                    }
                  `
              }
            </td>
          </tr>
        `;
      })
      .join('');

    renderPagination('users', usersTable);
  } catch (err) {
    if (requestId !== paginationState.users.requestId) return;

    usersTable.innerHTML = `
      <tr>
        <td colspan="5" class="p-4 text-center text-red-500">
          Erreur : ${escapeHTML(err.message)}
        </td>
      </tr>
    `;

    renderPagination('users', usersTable);
  }
}

usersTable?.addEventListener('click', (e) => {
  const statusBtn = e.target.closest('.btn-user-status');

  if (statusBtn) {
    toggleUserStatus(
      statusBtn.dataset.userId,
      statusBtn.dataset.userAction
    );

    return;
  }

  const roleBtn = e.target.closest('.btn-user-role');

  if (roleBtn) {
    const promoting =
      roleBtn.dataset.userRole === 'admin';

    const confirmMsg = promoting
      ? 'Nommer cet utilisateur administrateur ? Il aura alors un accès total au site.'
      : 'Retirer les droits administrateur de cet utilisateur ?';

    if (!confirm(confirmMsg)) return;

    toggleUserRole(
      roleBtn.dataset.userId,
      roleBtn.dataset.userRole
    );
  }
});

async function loadDocs() {
  if (!docsTable) return;

  const requestId = ++paginationState.docs.requestId;
  const state = paginationState.docs;
  const cursor = state.cursors[state.page] || null;

  docsTable.innerHTML = `
    <tr>
      <td colspan="4" class="p-4 text-center text-gray-500">
        Chargement des documents...
      </td>
    </tr>
  `;

  try {
    let request = supabase
      .from('documents')
      .select(`
        id,
        title,
        created_at,
        file_url,
        storage_bucket,
        storage_path,
        faculties(code),
        levels(code)
      `)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZES.docs + 1);

    request = applyCursor(request, cursor);

    const {
      data: rawDocs,
      error
    } = await request;

    if (requestId !== paginationState.docs.requestId) return;

    if (error) throw error;

    state.hasNext =
      (rawDocs || []).length > PAGE_SIZES.docs;

    const docs = (rawDocs || []).slice(
      0,
      PAGE_SIZES.docs
    );

    if (state.hasNext && docs.length > 0) {
      const last = docs[docs.length - 1];

      state.cursors[state.page + 1] = {
        created_at: last.created_at,
        id: last.id
      };
    } else {
      state.cursors.length = state.page + 1;
    }

    if (!docs || docs.length === 0) {
      docsTable.innerHTML = `
        <tr>
          <td colspan="4" class="p-4 text-center text-gray-500">
            Aucun document.
          </td>
        </tr>
      `;

      renderPagination('docs', docsTable);
      return;
    }

    docsTable.innerHTML = docs
      .map(
        (doc) => `
          <tr>
            <td class="p-3 font-semibold text-gray-800">
              ${escapeHTML(doc.title)}
            </td>

            <td class="p-3 text-gray-500">
              ${escapeHTML(doc.faculties?.code || 'N/A')}
              -
              ${escapeHTML(doc.levels?.code || '')}
            </td>

            <td class="p-3 text-gray-500">
              ${escapeHTML(
                new Date(doc.created_at).toLocaleDateString(
                  'fr-FR'
                )
              )}
            </td>

            <td class="p-3 text-right">
              <button
                data-doc-id="${escapeHTML(doc.id)}"
                class="btn-delete-doc text-red-600 hover:underline font-semibold text-xs"
              >
                Supprimer
              </button>
            </td>
          </tr>
        `
      )
      .join('');

    renderPagination('docs', docsTable);
  } catch (err) {
    if (requestId !== paginationState.docs.requestId) return;

    docsTable.innerHTML = `
      <tr>
        <td colspan="4" class="p-4 text-center text-red-500">
          Erreur : ${escapeHTML(err.message)}
        </td>
      </tr>
    `;

    renderPagination('docs', docsTable);
  }
}

docsTable?.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete-doc');

  if (!btn) return;

  deleteDoc(btn.dataset.docId);
});

function newsFormAlertShow(message, isError = false) {
  if (!newsFormAlert) return;

  newsFormAlert.textContent = message;

  newsFormAlert.className = `
    mb-4 p-3 text-xs rounded-md
    ${
      isError
        ? 'bg-red-100 text-red-700 border border-red-200'
        : 'bg-green-100 text-green-700 border border-green-200'
    }
  `;

  newsFormAlert.classList.remove('hidden');
}

async function loadNews() {
  if (!newsTable) return;

  const requestId = ++paginationState.news.requestId;
  const state = paginationState.news;
  const cursor = state.cursors[state.page] || null;

  newsTable.innerHTML = `
    <tr>
      <td colspan="3" class="p-4 text-center text-gray-500">
        Chargement des actualités...
      </td>
    </tr>
  `;

  try {
    let request = supabase
      .from('news')
      .select(
        'id, title, content, image_url, author_id, published_at, created_at'
      )
      .order('published_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZES.news + 1);

    request = applyNewsCursor(request, cursor);

    const {
      data: rawNews,
      error
    } = await request;

    if (requestId !== paginationState.news.requestId) return;

    if (error) throw error;

    state.hasNext =
      (rawNews || []).length > PAGE_SIZES.news;

    latestNewsItems = (rawNews || []).slice(
      0,
      PAGE_SIZES.news
    );

    if (
      state.hasNext &&
      latestNewsItems.length > 0
    ) {
      const last =
        latestNewsItems[latestNewsItems.length - 1];

      state.cursors[state.page + 1] = {
        published_at: last.published_at,
        id: last.id
      };
    } else {
      state.cursors.length = state.page + 1;
    }

    if (latestNewsItems.length === 0) {
      newsTable.innerHTML = `
        <tr>
          <td colspan="3" class="p-4 text-center text-gray-500">
            Aucune actualité publiée.
          </td>
        </tr>
      `;

      renderPagination('news', newsTable);
      return;
    }

    newsTable.innerHTML = latestNewsItems
      .map(
        (item) => `
          <tr>
            <td class="p-3 font-semibold text-gray-800">
              ${escapeHTML(item.title)}
            </td>

            <td class="p-3 text-gray-500">
              ${escapeHTML(
                new Date(
                  item.published_at
                ).toLocaleDateString('fr-FR')
              )}
            </td>

            <td class="p-3 text-right space-x-3">
              <button
                data-news-id="${escapeHTML(item.id)}"
                class="btn-edit-news text-jeap-accent-dark hover:underline font-semibold text-xs"
              >
                Modifier
              </button>

              <button
                data-news-id="${escapeHTML(item.id)}"
                class="btn-delete-news text-red-600 hover:underline font-semibold text-xs"
              >
                Supprimer
              </button>
            </td>
          </tr>
        `
      )
      .join('');

    renderPagination('news', newsTable);
  } catch (err) {
    if (requestId !== paginationState.news.requestId) return;

    newsTable.innerHTML = `
      <tr>
        <td colspan="3" class="p-4 text-center text-red-500">
          Erreur : ${escapeHTML(err.message)}
        </td>
      </tr>
    `;

    renderPagination('news', newsTable);
  }
}

newsTable?.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.btn-edit-news');

  if (editBtn) {
    const item = latestNewsItems.find(
      (n) => n.id === editBtn.dataset.newsId
    );

    if (item) editNews(item);

    return;
  }

  const deleteBtn = e.target.closest('.btn-delete-news');

  if (deleteBtn) {
    deleteNews(deleteBtn.dataset.newsId);
  }
});

function editNews(item) {
  if (!newsForm) return;

  newsIdField.value = item.id;
  newsTitleField.value = item.title || '';
  newsContentField.value = item.content || '';

  if (newsFormTitle) {
    newsFormTitle.textContent = 'Modifier l’actualité';
  }

  if (newsSubmitBtn) {
    newsSubmitBtn.textContent = 'Enregistrer les modifications';
  }

  if (newsCancelEditBtn) {
    newsCancelEditBtn.classList.remove('hidden');
  }

  newsForm.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function resetNewsForm() {
  if (!newsForm) return;

  newsForm.reset();
  newsIdField.value = '';

  if (newsFormTitle) {
    newsFormTitle.textContent = 'Publier une actualité';
  }

  if (newsSubmitBtn) {
    newsSubmitBtn.textContent = 'Publier';
  }

  if (newsCancelEditBtn) {
    newsCancelEditBtn.classList.add('hidden');
  }
}

newsCancelEditBtn?.addEventListener(
  'click',
  resetNewsForm
);

if (newsForm) {
  newsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = newsIdField.value;
    const title = newsTitleField.value.trim();
    const content = newsContentField.value.trim();
    const file = newsImageField?.files?.[0];

    if (!title || !content) {
      newsFormAlertShow(
        'Merci de remplir le titre et le contenu.',
        true
      );
      return;
    }

    if (file && !file.type.startsWith('image/')) {
      newsFormAlertShow(
        'Le fichier sélectionné doit être une image.',
        true
      );
      return;
    }

    newsSubmitBtn.disabled = true;

    try {
      let image_url;
      let uploadedImagePath = null;

      if (file) {
        const fileExt =
          file.name.split('.').pop()?.toLowerCase() ||
          'jpg';

        const fileName =
          `${crypto.randomUUID()}.${fileExt}`;

        const filePath = `news/${fileName}`;

        const {
          error: uploadError
        } = await supabase.storage
          .from('jeap-docs')
          .upload(
            filePath,
            file,
            {
              cacheControl: '3600',
              upsert: false
            }
          );

        if (uploadError) throw uploadError;

        uploadedImagePath = filePath;

        const {
          data: publicUrlData
        } = supabase.storage
          .from('jeap-docs')
          .getPublicUrl(filePath);

        image_url =
          publicUrlData.publicUrl;
      }

      try {
        if (id) {
          const updatePayload = {
            title,
            content
          };

          if (image_url) {
            updatePayload.image_url = image_url;
          }

          const {
            error
          } = await supabase
            .from('news')
            .update(updatePayload)
            .eq('id', id);

          if (error) throw error;

          newsFormAlertShow(
            'Actualité mise à jour avec succès.'
          );
        } else {
          const {
            data: { user }
          } = await supabase.auth.getUser();

          if (!user) {
            throw new Error(
              'Session administrateur introuvable.'
            );
          }

          const {
            error
          } = await supabase
            .from('news')
            .insert([
              {
                title,
                content,
                image_url: image_url || null,
                author_id: user.id
              }
            ]);

          if (error) throw error;

          newsFormAlertShow(
            'Actualité publiée avec succès.'
          );
        }
      } catch (dbError) {
        if (uploadedImagePath) {
          await supabase.storage
            .from('jeap-docs')
            .remove([uploadedImagePath]);
        }

        throw dbError;
      }

      resetNewsForm();
      resetPagination('news');
      await loadNews();
    } catch (err) {
      newsFormAlertShow(
        `Erreur : ${err.message}`,
        true
      );
    } finally {
      newsSubmitBtn.disabled = false;
    }
  });
}

async function deleteNews(newsId) {
  if (
    !confirm(
      'Voulez-vous vraiment supprimer cette actualité ?'
    )
  ) {
    return;
  }

  const item = latestNewsItems.find(
    (news) => news.id === newsId
  );

  const {
    error
  } = await supabase
    .from('news')
    .delete()
    .eq('id', newsId);

  if (error) {
    alert(
      `Erreur lors de la suppression : ${error.message}`
    );
    return;
  }

  if (item?.image_url) {
    const marker =
      '/storage/v1/object/public/jeap-docs/';

    const index =
      item.image_url.indexOf(marker);

    if (index !== -1) {
      const path = decodeURIComponent(
        item.image_url.slice(
          index + marker.length
        )
      );

      if (path.startsWith('news/')) {
        await supabase.storage
          .from('jeap-docs')
          .remove([path]);
      }
    }
  }

  if (
    paginationState.news.page > 0 &&
    latestNewsItems.length === 1
  ) {
    paginationState.news.page -= 1;
  }

  await loadNews();
}

function bureauFormAlertShow(
  message,
  isError = false
) {
  if (!bureauFormAlert) return;

  bureauFormAlert.textContent = message;

  bureauFormAlert.className = `
    mb-4 p-3 text-xs rounded-md
    ${
      isError
        ? 'bg-red-100 text-red-700 border border-red-200'
        : 'bg-green-100 text-green-700 border border-green-200'
    }
  `;

  bureauFormAlert.classList.remove('hidden');
}

async function loadBureau() {
  if (!bureauTable) return;

  try {
    const {
      data: members,
      error
    } = await supabase
      .from('bureau_members')
      .select(
        'id, full_name, role_label, photo_url, email, whatsapp_phone, facebook_url, facebook_label, academic_year, sort_order, is_active, created_at, updated_at'
      )
      .order('sort_order', {
        ascending: true
      });

    if (error) throw error;

    latestBureauItems = members || [];

    if (latestBureauItems.length === 0) {
      bureauTable.innerHTML = `
        <tr>
          <td colspan="5" class="p-4 text-center text-gray-500">
            Aucun membre enregistré.
          </td>
        </tr>
      `;

      return;
    }

    bureauTable.innerHTML =
      latestBureauItems
        .map(
          (m) => `
            <tr>
              <td class="p-3">
                <div class="w-8 h-8 rounded-full bg-jeap-bg overflow-hidden flex items-center justify-center text-sm">
                  ${
                    m.photo_url
                      ? `
                        <img
                          src="${escapeHTML(m.photo_url)}"
                          alt=""
                          class="w-full h-full object-cover"
                        >
                      `
                      : '👤'
                  }
                </div>
              </td>

              <td class="p-3 font-semibold text-gray-800">
                ${escapeHTML(m.full_name)}
                ${
                  m.is_active === false
                    ? ' <span class="text-gray-400">(masqué)</span>'
                    : ''
                }
              </td>

              <td class="p-3 text-gray-500">
                ${escapeHTML(m.role_label)}
              </td>

              <td class="p-3 text-gray-500">
                ${escapeHTML(m.academic_year)}
              </td>

              <td class="p-3 text-right space-x-3 whitespace-nowrap">
                <button
                  data-bureau-id="${escapeHTML(m.id)}"
                  class="btn-edit-bureau text-jeap-accent-dark hover:underline font-semibold text-xs"
                >
                  Modifier
                </button>

                <button
                  data-bureau-id="${escapeHTML(m.id)}"
                  class="btn-delete-bureau text-red-600 hover:underline font-semibold text-xs"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          `
        )
        .join('');
  } catch (err) {
    bureauTable.innerHTML = `
      <tr>
        <td colspan="5" class="p-4 text-center text-red-500">
          Erreur : ${escapeHTML(err.message)}
        </td>
      </tr>
    `;
  }
}

bureauTable?.addEventListener('click', (e) => {
  const editBtn =
    e.target.closest('.btn-edit-bureau');

  if (editBtn) {
    const item =
      latestBureauItems.find(
        (m) => m.id === editBtn.dataset.bureauId
      );

    if (item) editBureau(item);

    return;
  }

  const deleteBtn =
    e.target.closest('.btn-delete-bureau');

  if (deleteBtn) {
    deleteBureau(
      deleteBtn.dataset.bureauId
    );
  }
});

function editBureau(item) {
  if (!bureauForm) return;

  bureauIdField.value = item.id;
  bureauFullNameField.value =
    item.full_name || '';
  bureauRoleField.value =
    item.role_label || '';
  bureauEmailField.value =
    item.email || '';
  bureauWhatsappField.value =
    item.whatsapp_phone || '';
  bureauFacebookUrlField.value =
    item.facebook_url || '';
  bureauFacebookLabelField.value =
    item.facebook_label || '';
  bureauYearField.value =
    item.academic_year || '';
  bureauSortOrderField.value =
    item.sort_order ?? 0;

  if (bureauFormTitle) {
    bureauFormTitle.textContent =
      'Modifier un membre du bureau';
  }

  if (bureauSubmitBtn) {
    bureauSubmitBtn.textContent =
      'Enregistrer les modifications';
  }

  if (bureauCancelEditBtn) {
    bureauCancelEditBtn.classList.remove(
      'hidden'
    );
  }

  bureauForm.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function resetBureauForm() {
  if (!bureauForm) return;

  bureauForm.reset();
  bureauIdField.value = '';
  bureauSortOrderField.value = 0;

  if (bureauFormTitle) {
    bureauFormTitle.textContent =
      'Ajouter un membre du bureau';
  }

  if (bureauSubmitBtn) {
    bureauSubmitBtn.textContent = 'Ajouter';
  }

  if (bureauCancelEditBtn) {
    bureauCancelEditBtn.classList.add(
      'hidden'
    );
  }
}

bureauCancelEditBtn?.addEventListener(
  'click',
  resetBureauForm
);

if (bureauForm) {
  bureauForm.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();

      const id = bureauIdField.value;
      const full_name =
        bureauFullNameField.value.trim();
      const role_label =
        bureauRoleField.value.trim();
      const email =
        bureauEmailField.value.trim();
      const whatsapp_phone =
        bureauWhatsappField.value
          .trim()
          .replace(/\D/g, '');
      const facebook_url =
        bureauFacebookUrlField.value.trim();
      const facebook_label =
        bureauFacebookLabelField.value.trim();
      const academic_year =
        bureauYearField.value.trim();
      const sort_order =
        parseInt(
          bureauSortOrderField.value,
          10
        ) || 0;
      const file =
        bureauPhotoField?.files?.[0];

      if (
        !full_name ||
        !role_label ||
        !academic_year
      ) {
        bureauFormAlertShow(
          "Merci de remplir au minimum le nom, le poste et l'année académique.",
          true
        );
        return;
      }

      if (
        !/^\d{4}-\d{4}$/.test(
          academic_year
        )
      ) {
        bureauFormAlertShow(
          "L'année académique doit respecter le format 2026-2027.",
          true
        );
        return;
      }

      if (
        file &&
        !file.type.startsWith('image/')
      ) {
        bureauFormAlertShow(
          'Le fichier sélectionné doit être une image.',
          true
        );
        return;
      }

      bureauSubmitBtn.disabled = true;

      try {
        let photo_url;
        let uploadedPhotoPath = null;

        if (file) {
          const fileExt =
            file.name
              .split('.')
              .pop()
              ?.toLowerCase() ||
            'jpg';

          const fileName =
            `${crypto.randomUUID()}.${fileExt}`;

          const filePath =
            `bureau/${fileName}`;

          const {
            error: uploadError
          } = await supabase.storage
            .from('jeap-docs')
            .upload(
              filePath,
              file,
              {
                cacheControl: '3600',
                upsert: false
              }
            );

          if (uploadError) {
            throw uploadError;
          }

          uploadedPhotoPath = filePath;

          const {
            data: publicUrlData
          } = supabase.storage
            .from('jeap-docs')
            .getPublicUrl(
              filePath
            );

          photo_url =
            publicUrlData.publicUrl;
        }

        const payload = {
          full_name,
          role_label,
          email: email || null,
          whatsapp_phone:
            whatsapp_phone || null,
          facebook_url:
            facebook_url || null,
          facebook_label:
            facebook_label || null,
          academic_year,
          sort_order
        };

        if (photo_url) {
          payload.photo_url = photo_url;
        }

        try {
          if (id) {
            const {
              error
            } = await supabase
              .from('bureau_members')
              .update(payload)
              .eq('id', id);

            if (error) throw error;

            bureauFormAlertShow(
              'Membre mis à jour avec succès.'
            );
          } else {
            const {
              error
            } = await supabase
              .from('bureau_members')
              .insert([payload]);

            if (error) throw error;

            bureauFormAlertShow(
              'Membre ajouté avec succès.'
            );
          }
        } catch (dbError) {
          if (uploadedPhotoPath) {
            await supabase.storage
              .from('jeap-docs')
              .remove([
                uploadedPhotoPath
              ]);
          }

          throw dbError;
        }

        resetBureauForm();
        await loadBureau();
      } catch (err) {
        bureauFormAlertShow(
          `Erreur : ${err.message}`,
          true
        );
      } finally {
        bureauSubmitBtn.disabled = false;
      }
    }
  );
}

async function deleteBureau(bureauId) {
  if (
    !confirm(
      'Voulez-vous vraiment retirer ce membre du bureau ?'
    )
  ) {
    return;
  }

  const member =
    latestBureauItems.find(
      (item) => item.id === bureauId
    );

  const {
    error
  } = await supabase
    .from('bureau_members')
    .delete()
    .eq('id', bureauId);

  if (error) {
    alert(
      `Erreur lors de la suppression : ${error.message}`
    );
    return;
  }

  if (member?.photo_url) {
    const marker =
      '/storage/v1/object/public/jeap-docs/';

    const index =
      member.photo_url.indexOf(marker);

    if (index !== -1) {
      const path =
        decodeURIComponent(
          member.photo_url.slice(
            index + marker.length
          )
        );

      if (path.startsWith('bureau/')) {
        await supabase.storage
          .from('jeap-docs')
          .remove([path]);
      }
    }
  }

  await loadBureau();
}

async function toggleUserStatus(
  userId,
  newStatus
) {
  if (
    !['approved', 'rejected'].includes(
      newStatus
    )
  ) {
    return;
  }

  if (userId === currentUserId) {
    alert(
      'Vous ne pouvez pas bloquer votre propre compte administrateur.'
    );
    return;
  }

  const {
    error
  } = await supabase
    .from('profiles')
    .update({
      status: newStatus
    })
    .eq('id', userId);

  if (error) {
    alert(
      `Erreur lors de la mise à jour : ${error.message}`
    );
  } else {
    await loadUsers();
  }
}

async function toggleUserRole(
  userId,
  newRole
) {
  if (
    !['admin', 'student'].includes(
      newRole
    )
  ) {
    return;
  }

  if (userId === currentUserId) {
    alert(
      'Vous ne pouvez pas modifier votre propre rôle depuis cette page.'
    );
    return;
  }

  const {
    error
  } = await supabase
    .from('profiles')
    .update({
      role: newRole
    })
    .eq('id', userId);

  if (error) {
    alert(
      `Erreur lors de la mise à jour du rôle : ${error.message}`
    );
  } else {
    await loadUsers();
  }
}

async function deleteDoc(docId) {
  if (
    !confirm(
      'Voulez-vous vraiment supprimer ce document ?'
    )
  ) {
    return;
  }

  try {
    const {
      data: document,
      error: fetchError
    } = await supabase
      .from('documents')
      .select(
        'id, file_url, storage_bucket, storage_path'
      )
      .eq('id', docId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!document) {
      alert('Document introuvable.');
      return;
    }

    let bucket =
      document.storage_bucket || null;

    let path =
      document.storage_path || null;

    /*
     * Compatibilité avec les anciens documents
     * qui n'ont pas encore storage_bucket/storage_path
     * renseignés.
     */
    if (
      (!bucket || !path) &&
      document.file_url
    ) {
      const markers = [
        '/storage/v1/object/public/jeap-documents/',
        '/storage/v1/object/public/jeap-docs/'
      ];

      for (const marker of markers) {
        const index =
          document.file_url.indexOf(
            marker
          );

        if (index !== -1) {
          bucket =
            marker.includes(
              '/jeap-documents/'
            )
              ? 'jeap-documents'
              : 'jeap-docs';

          path =
            decodeURIComponent(
              document.file_url.slice(
                index + marker.length
              )
            );

          break;
        }
      }
    }

    /*
     * Le fichier doit être supprimé avant
     * la ligne PostgreSQL.
     *
     * Si Storage refuse la suppression,
     * on conserve le document DB afin d'éviter
     * de créer volontairement un état incohérent.
     */
    if (bucket && path) {
      const {
        error: storageError
      } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (storageError) {
        throw new Error(
          `Le fichier Storage n'a pas pu être supprimé : ${storageError.message}`
        );
      }
    }

    const {
      error: deleteError
    } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (deleteError) {
      throw deleteError;
    }

    await loadDocs();
  } catch (error) {
    console.error(
      'Erreur lors de la suppression du document :',
      error
    );

    alert(
      `Erreur lors de la suppression : ${error.message}`
    );
  }
}

bindPaginationEvents();

(async () => {
  const isAdmin =
    await checkAdminAccess();

  if (!isAdmin) return;

  await Promise.allSettled([
    loadUsers(),
    loadDocs(),
    loadNews(),
    loadBureau()
  ]);
})();