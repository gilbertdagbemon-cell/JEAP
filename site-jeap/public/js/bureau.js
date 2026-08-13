import { supabase } from './supabaseClient.js';
import { escapeHTML, safeUrl } from './utils.js';

// Ce script alimente deux blocs différents à partir de la même table
// "bureau_members" :
//   - #bureau-grid  (page a-propos.html) : cartes photo + nom + poste
//   - #contact-emails / #contact-whatsapp / #contact-facebook (contact.html)
//     : mêmes personnes, vues sous l'angle "moyens de contact"
// Un seul et même chargement Supabase alimente donc l'À propos ET le
// Contact : mettre à jour le bureau une fois par an suffit pour les deux.

const bureauGrid = document.getElementById('bureau-grid');
const contactEmails = document.getElementById('contact-emails');
const contactWhatsapp = document.getElementById('contact-whatsapp');
const contactFacebook = document.getElementById('contact-facebook');

function renderBureauGrid(members) {
  if (!bureauGrid) return;

  if (members.length === 0) {
    bureauGrid.innerHTML = `<p class="text-xs text-gray-500 col-span-full text-center py-8">La composition du bureau sera bientôt publiée.</p>`;
    return;
  }

  bureauGrid.innerHTML = members.map(m => {
    const photo = safeUrl(m.photo_url);
    const socialLinks = [];

    if (m.email) {
      socialLinks.push(`<a href="mailto:${escapeHTML(m.email)}" class="hover:text-jeap-accent-dark" aria-label="E-mail de ${escapeHTML(m.full_name)}" title="E-mail">✉️</a>`);
    }
    if (m.whatsapp_phone) {
      socialLinks.push(`<a href="https://wa.me/${encodeURIComponent(m.whatsapp_phone)}" target="_blank" rel="noopener" class="hover:text-jeap-accent-dark" aria-label="WhatsApp de ${escapeHTML(m.full_name)}" title="WhatsApp">💬</a>`);
    }
    if (m.facebook_url) {
      const fbUrl = safeUrl(m.facebook_url);
      if (fbUrl) {
        socialLinks.push(`<a href="${fbUrl}" target="_blank" rel="noopener" class="hover:text-jeap-accent-dark" aria-label="Facebook de ${escapeHTML(m.full_name)}" title="Facebook">📘</a>`);
      }
    }

    return `
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
      <div class="w-28 h-28 mx-auto rounded-full bg-jeap-bg overflow-hidden ring-2 ring-jeap-bg flex items-center justify-center text-4xl mb-4">
        ${photo ? `<img src="${photo}" alt="Photo de ${escapeHTML(m.full_name)}" class="w-full h-full object-cover" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
        <span class="w-full h-full items-center justify-center" style="${photo ? 'display:none' : 'display:flex'}">👤</span>
      </div>
      <p class="text-base font-semibold">${escapeHTML(m.full_name)}</p>
      <p class="text-sm text-gray-500 mb-2">${escapeHTML(m.role_label)}</p>
      ${socialLinks.length ? `<div class="flex items-center justify-center gap-3 text-lg mt-2">${socialLinks.join('')}</div>` : ''}
    </div>`;
  }).join('');
}

function renderContactBlocks(members) {
  if (!contactEmails && !contactWhatsapp && !contactFacebook) return;

  const emails = members.filter(m => m.email);
  const whatsapps = members.filter(m => m.whatsapp_phone);
  const facebooks = members.filter(m => m.facebook_url);

  if (contactEmails) {
    contactEmails.innerHTML = emails.length
      ? emails.map(m => `<a href="mailto:${escapeHTML(m.email)}" class="block text-xs text-jeap-accent-dark hover:underline break-words">${escapeHTML(m.email)}</a>`).join('')
      : `<p class="text-xs text-gray-500">Aucune adresse renseignée pour le moment.</p>`;
  }

  if (contactWhatsapp) {
    contactWhatsapp.innerHTML = whatsapps.length
      ? whatsapps.map(m => {
          const display = formatPhoneDisplay(m.whatsapp_phone);
          return `<a href="https://wa.me/${encodeURIComponent(m.whatsapp_phone)}" target="_blank" rel="noopener" class="block text-xs text-jeap-accent-dark hover:underline">${escapeHTML(display)}</a>`;
        }).join('')
      : `<p class="text-xs text-gray-500">Aucun numéro renseigné pour le moment.</p>`;
  }

  if (contactFacebook) {
    contactFacebook.innerHTML = facebooks.length
      ? facebooks.map(m => {
          const fbUrl = safeUrl(m.facebook_url);
          if (!fbUrl) return '';
          const label = m.facebook_label || `Facebook - ${m.full_name}`;
          return `<a href="${fbUrl}" target="_blank" rel="noopener" class="block text-xs text-jeap-accent-dark hover:underline break-words">${escapeHTML(label)}</a>`;
        }).join('')
      : `<p class="text-xs text-gray-500">Aucun lien renseigné pour le moment.</p>`;
  }
}

// Reformate un numéro stocké au format international brut (ex: "229166109045")
// en affichage lisible "+229 01 66 10 90 45" (indicatif 229 = Bénin, ajout
// du "0" local après l'indicatif comme dans l'affichage d'origine).
function formatPhoneDisplay(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('229') && digits.length === 12) {
    const local = '0' + digits.slice(3); // ex: 0166109045
    const grouped = local.match(/.{1,2}/g)?.join(' ') || local;
    return `+229 ${grouped}`;
  }
  return `+${digits}`;
}

async function fetchBureau() {
  if (!bureauGrid && !contactEmails && !contactWhatsapp && !contactFacebook) return;

  try {
    const { data, error } = await supabase
      .from('bureau_members')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const members = data || [];
    renderBureauGrid(members);
    renderContactBlocks(members);
  } catch (err) {
    const message = `<p class="text-xs text-red-500 col-span-full text-center py-8">Erreur de chargement du bureau : ${escapeHTML(err.message)}</p>`;
    if (bureauGrid) bureauGrid.innerHTML = message;
  }
}

fetchBureau();
