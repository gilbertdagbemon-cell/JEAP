// js/upload.js
//
// CORRIGÉ : ce fichier envoyait auparavant des données qui ne correspondaient
// pas au schéma réel de la table "documents" (colonnes inexistantes, codes
// texte envoyés là où la base attend des UUID de clé étrangère...). Résultat :
// Supabase rejetait systématiquement l'insertion et le dépôt de document
// échouait à chaque fois.
//
// Correction : on va chercher les vraies listes (facultés, filières, niveaux,
// types, années) directement dans Supabase, comme le fait déjà documents.js
// pour l'affichage, et on envoie les bons noms de colonnes avec les bons
// types (UUID) attendus par supabase/schema.sql.

import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {

  const facultySelect = document.getElementById('doc-faculty');
  const programSelect = document.getElementById('doc-program');
  const levelSelect = document.getElementById('doc-level');
  const typeSelect = document.getElementById('doc-type');
  const yearSelect = document.getElementById('doc-year');
  const uploadForm = document.getElementById('upload-form');
  const alertMessage = document.getElementById('alert-message');
  const publishBtn = document.getElementById('publish-btn');

  // ===============================
  // Garde d'accès : la page est réservée aux membres connectés
  // ===============================
  async function checkAuthGuard() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      showAlert("Vous devez être connecté pour déposer un document. Redirection...", "error");
      if (uploadForm) uploadForm.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
      setTimeout(() => { window.location.href = 'connexion.html'; }, 1800);
      return false;
    }
    return true;
  }

  // ===============================
  // Initialisation des listes déroulantes DEPUIS LA BASE
  // (facultés, filières, niveaux, types, années) — on utilise les vrais
  // identifiants (UUID) de chaque table de référence comme value des options,
  // c'est ce que la table documents attend en clé étrangère.
  // ===============================
  async function initFaculties() {
    if (!facultySelect) return;

    const { data, error } = await supabase
      .from('faculties')
      .select('id, code, name')
      .order('name');

    if (error) {
      showAlert(`Erreur de chargement des facultés : ${error.message}`, "error");
      return;
    }

    facultySelect.innerHTML = '<option value="" disabled selected>Choisir une faculté / école...</option>';
    (data || []).forEach(fac => {
      const opt = document.createElement('option');
      opt.value = fac.id; // UUID -> correspond à documents.faculty_id
      opt.textContent = `${fac.code} - ${fac.name}`;
      facultySelect.appendChild(opt);
    });
  }

  facultySelect?.addEventListener('change', async (e) => {
    const facultyId = e.target.value;

    programSelect.innerHTML = '<option value="" disabled selected>Choisir une filière...</option>';
    programSelect.disabled = true;

    if (!facultyId) return;

    const { data, error } = await supabase
      .from('programs')
      .select('id, code, name')
      .eq('faculty_id', facultyId)
      .order('name');

    if (error) {
      showAlert(`Erreur de chargement des filières : ${error.message}`, "error");
      return;
    }

    (data || []).forEach(prog => {
      const opt = document.createElement('option');
      opt.value = prog.id; // UUID -> correspond à documents.program_id
      opt.textContent = prog.code ? `${prog.name} (${prog.code})` : prog.name;
      programSelect.appendChild(opt);
    });
    programSelect.disabled = false;
  });

  async function initLevels() {
    if (!levelSelect) return;

    const { data, error } = await supabase
      .from('levels')
      .select('id, code, label')
      .order('sort_order');

    if (error) {
      showAlert(`Erreur de chargement des niveaux : ${error.message}`, "error");
      return;
    }

    levelSelect.innerHTML = '<option value="" disabled selected>Choisir un niveau...</option>';
    (data || []).forEach(lvl => {
      const opt = document.createElement('option');
      opt.value = lvl.id; // UUID -> correspond à documents.level_id
      opt.textContent = lvl.label;
      levelSelect.appendChild(opt);
    });
  }

  async function initTypes() {
    if (!typeSelect) return;

    const { data, error } = await supabase
      .from('document_types')
      .select('id, code, label');

    if (error) {
      showAlert(`Erreur de chargement des types de document : ${error.message}`, "error");
      return;
    }

    typeSelect.innerHTML = '<option value="" disabled selected>Choisir le type...</option>';
    (data || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; // UUID -> correspond à documents.document_type_id
      opt.textContent = t.label;
      typeSelect.appendChild(opt);
    });
  }

  // Le sélecteur d'année reste "texte libre" côté UI (ex. "2026-2027"), pour
  // permettre de choisir une année future qui n'existe pas encore en base.
  // On la résout / crée côté base juste avant l'envoi (voir resolveAcademicYearId),
  // via la fonction RPC get_or_create_academic_year (cf. supabase/schema.sql).
  function initYears() {
    if (!yearSelect) return;

    const anneeDepart = new Date().getFullYear();
    const nombreAnneesFutures = 20;
    const annees = Array.from({ length: nombreAnneesFutures }, (_, i) => {
      const y = anneeDepart + i;
      return `${y}-${y + 1}`;
    });

    function remplir(toutes = false) {
      yearSelect.innerHTML = '';
      const defaut = new Option("Choisir l'année académique...", "");
      defaut.disabled = true;
      defaut.selected = true;
      yearSelect.add(defaut);

      annees.slice(0, toutes ? annees.length : 4).forEach(a => {
        yearSelect.add(new Option(a, a));
      });

      if (!toutes) {
        const more = new Option("➕ Choisir d'autres années...", "__MORE__");
        more.style.fontWeight = "bold";
        yearSelect.add(more);
      }
    }

    remplir(false);

    yearSelect.addEventListener('change', () => {
      if (yearSelect.value === '__MORE__') {
        remplir(true);
        yearSelect.value = '';
      }
    });
  }

  async function initAll() {
    const ok = await checkAuthGuard();
    if (!ok) return;

    await Promise.all([
      initFaculties(),
      initLevels(),
      initTypes()
    ]);
    initYears();
  }

  initAll();

  // ===============================
  // Résout le libellé d'année académique (ex. "2026-2027") en UUID
  // academic_year_id, en créant la ligne en base si elle n'existe pas encore.
  // ===============================
  async function resolveAcademicYearId(yearLabel) {
    const { data, error } = await supabase.rpc('get_or_create_academic_year', {
      p_year_label: yearLabel
    });
    if (error) throw error;
    return data;
  }

  // ===============================
  // Upload + Supabase
  // ===============================
  uploadForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = "⏳ Publication en cours...";
    }

    showAlert("Envoi du document en cours...", "info");

    try {
      const fileInput = document.getElementById('doc-file');
      const file = fileInput.files[0];

      if (!file) {
        throw new Error("Veuillez sélectionner un fichier PDF.");
      }

      if (file.type !== "application/pdf") {
        throw new Error("Seuls les fichiers PDF sont acceptés.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("La taille maximale est de 10 Mo.");
      }

      const title = document.getElementById('doc-title').value.trim();
      const subject = document.getElementById('doc-subject').value.trim();

      if (!title) throw new Error("Le titre est obligatoire.");
      if (!subject) throw new Error("La matière est obligatoire.");
      if (!facultySelect.value) throw new Error("Veuillez choisir une faculté / école.");
      if (!programSelect.value) throw new Error("Veuillez choisir une filière.");
      if (!levelSelect.value) throw new Error("Veuillez choisir un niveau.");
      if (!typeSelect.value) throw new Error("Veuillez choisir un type de document.");
      if (!yearSelect.value || yearSelect.value === '__MORE__') throw new Error("Veuillez choisir une année académique.");

      // 0. Utilisateur connecté (obligatoire, vérifié aussi par la policy RLS)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Votre session a expiré. Merci de vous reconnecter.");
      }

      // 1. Résolution de l'année académique -> UUID
      const academicYearId = await resolveAcademicYearId(yearSelect.value);

      // 2. Nom de fichier unique dans le Storage
      const extension = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const filePath = `documents/${fileName}`;

      // 3. Upload du fichier dans Storage "jeap-docs"
      const { error: storageError } = await supabase.storage
        .from('jeap-docs')
        .upload(filePath, file);

      if (storageError) throw storageError;

      // 4. URL publique du fichier
      const { data: publicUrlData } = supabase.storage
        .from('jeap-docs')
        .getPublicUrl(filePath);

      const pdfUrl = publicUrlData.publicUrl;

      // 5. Enregistrement en base de données — noms de colonnes ET types
      // alignés sur supabase/schema.sql (public.documents)
      const { error: dbError } = await supabase.from('documents').insert([{
        title,
        subject,
        faculty_id: facultySelect.value,
        program_id: programSelect.value,
        level_id: levelSelect.value,
        document_type_id: typeSelect.value,
        academic_year_id: academicYearId,
        file_url: pdfUrl,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploader_id: user.id
      }]);

      if (dbError) {
        // Si l'insertion échoue, on essaie de nettoyer le fichier déjà envoyé
        // dans le Storage pour ne pas laisser de fichier orphelin.
        await supabase.storage.from('jeap-docs').remove([filePath]);
        throw dbError;
      }

      showAlert("Document publié avec succès !", "success");

      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML = "✅ Document publié";
      }

      uploadForm.reset();
      programSelect.disabled = true;

    } catch (err) {
      console.error(err);

      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML = "📤 Publier le document";
      }

      showAlert(`Erreur : ${err.message}`, "error");
    }
  });

  // ===============================
  // Messages d'alerte
  // ===============================
  function showAlert(message, type) {
    if (!alertMessage) return;

    const styles = {
      success: "bg-green-100 text-green-700 border border-green-200",
      error: "bg-red-100 text-red-700 border border-red-200",
      info: "bg-blue-100 text-blue-700 border border-blue-200"
    };

    alertMessage.className = `p-3 rounded-lg text-sm mb-4 ${styles[type] || styles.info}`;
    alertMessage.textContent = message;
    alertMessage.classList.remove('hidden');
  }

});
