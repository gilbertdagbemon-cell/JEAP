// js/upload.js
//
// Gestion du dépôt des documents.
//
// Les informations Storage (bucket + chemin) sont enregistrées dans
// la table documents afin de permettre ensuite la suppression propre
// du fichier Storage lorsqu'un document est supprimé.

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
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.user) {
      showAlert(
        "Vous devez être connecté pour déposer un document. Redirection...",
        "error"
      );

      if (uploadForm) {
        uploadForm
          .querySelectorAll('input, select, button')
          .forEach((el) => {
            el.disabled = true;
          });
      }

      setTimeout(() => {
        window.location.href = 'connexion.html';
      }, 1800);

      return false;
    }

    return true;
  }

  // ===============================
  // Initialisation des facultés
  // ===============================
  async function initFaculties() {
    if (!facultySelect) return;

    const { data, error } = await supabase
      .from('faculties')
      .select('id, code, name')
      .order('name');

    if (error) {
      showAlert(
        `Erreur de chargement des facultés : ${error.message}`,
        "error"
      );
      return;
    }

    facultySelect.innerHTML =
      '<option value="" disabled selected>Choisir une faculté / école...</option>';

    (data || []).forEach((faculty) => {
      const option = document.createElement('option');

      option.value = faculty.id;
      option.textContent = `${faculty.code} - ${faculty.name}`;

      facultySelect.appendChild(option);
    });
  }

  // ===============================
  // Chargement des filières selon la faculté
  // ===============================
  facultySelect?.addEventListener('change', async (event) => {
    const facultyId = event.target.value;

    programSelect.innerHTML =
      '<option value="" disabled selected>Choisir une filière...</option>';

    programSelect.disabled = true;

    if (!facultyId) return;

    const { data, error } = await supabase
      .from('programs')
      .select('id, code, name')
      .eq('faculty_id', facultyId)
      .order('name');

    if (error) {
      showAlert(
        `Erreur de chargement des filières : ${error.message}`,
        "error"
      );
      return;
    }

    (data || []).forEach((program) => {
      const option = document.createElement('option');

      option.value = program.id;
      option.textContent = program.code
        ? `${program.name} (${program.code})`
        : program.name;

      programSelect.appendChild(option);
    });

    programSelect.disabled = false;
  });

  // ===============================
  // Initialisation des niveaux
  // ===============================
  async function initLevels() {
    if (!levelSelect) return;

    const { data, error } = await supabase
      .from('levels')
      .select('id, code, label')
      .order('sort_order');

    if (error) {
      showAlert(
        `Erreur de chargement des niveaux : ${error.message}`,
        "error"
      );
      return;
    }

    levelSelect.innerHTML =
      '<option value="" disabled selected>Choisir un niveau...</option>';

    (data || []).forEach((level) => {
      const option = document.createElement('option');

      option.value = level.id;
      option.textContent = level.label;

      levelSelect.appendChild(option);
    });
  }

  // ===============================
  // Initialisation des types de document
  // ===============================
  async function initTypes() {
    if (!typeSelect) return;

    const { data, error } = await supabase
      .from('document_types')
      .select('id, code, label');

    if (error) {
      showAlert(
        `Erreur de chargement des types de document : ${error.message}`,
        "error"
      );
      return;
    }

    typeSelect.innerHTML =
      '<option value="" disabled selected>Choisir le type...</option>';

    (data || []).forEach((type) => {
      const option = document.createElement('option');

      option.value = type.id;
      option.textContent = type.label;

      typeSelect.appendChild(option);
    });
  }

  // ===============================
  // Initialisation des années académiques
  // ===============================
  function initYears() {
    if (!yearSelect) return;

    const anneeDepart = new Date().getFullYear();
    const nombreAnneesFutures = 20;

    const annees = Array.from(
      { length: nombreAnneesFutures },
      (_, index) => {
        const year = anneeDepart + index;
        return `${year}-${year + 1}`;
      }
    );

    function remplir(toutes = false) {
      yearSelect.innerHTML = '';

      const defaut = new Option(
        "Choisir l'année académique...",
        ""
      );

      defaut.disabled = true;
      defaut.selected = true;

      yearSelect.add(defaut);

      annees
        .slice(0, toutes ? annees.length : 4)
        .forEach((annee) => {
          yearSelect.add(new Option(annee, annee));
        });

      if (!toutes) {
        const more = new Option(
          "➕ Choisir d'autres années...",
          "__MORE__"
        );

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

  // ===============================
  // Initialisation générale
  // ===============================
  async function initAll() {
    const authenticated = await checkAuthGuard();

    if (!authenticated) return;

    await Promise.all([
      initFaculties(),
      initLevels(),
      initTypes()
    ]);

    initYears();
  }

  initAll();

  // ===============================
  // Résolution de l'année académique
  // ===============================
  async function resolveAcademicYearId(yearLabel) {
    const { data, error } = await supabase.rpc(
      'get_or_create_academic_year',
      {
        p_year_label: yearLabel
      }
    );

    if (error) throw error;

    return data;
  }

  // ===============================
  // Upload du document
  // ===============================
  uploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (publishBtn) {
      publishBtn.disabled = true;
      publishBtn.innerHTML = "⏳ Publication en cours...";
    }

    showAlert(
      "Envoi du document en cours...",
      "info"
    );

    try {
      const fileInput = document.getElementById('doc-file');
      const file = fileInput?.files?.[0];

      if (!file) {
        throw new Error("Veuillez sélectionner un fichier.");
      }

      const title = document
        .getElementById('doc-title')
        .value
        .trim();

      const subject = document
        .getElementById('doc-subject')
        .value
        .trim();

      if (!title) {
        throw new Error("Le titre est obligatoire.");
      }

      if (!subject) {
        throw new Error("La matière est obligatoire.");
      }

      if (!facultySelect.value) {
        throw new Error(
          "Veuillez choisir une faculté / école."
        );
      }

      if (!programSelect.value) {
        throw new Error(
          "Veuillez choisir une filière."
        );
      }

      if (!levelSelect.value) {
        throw new Error(
          "Veuillez choisir un niveau."
        );
      }

      if (!typeSelect.value) {
        throw new Error(
          "Veuillez choisir un type de document."
        );
      }

      if (
        !yearSelect.value ||
        yearSelect.value === '__MORE__'
      ) {
        throw new Error(
          "Veuillez choisir une année académique."
        );
      }

      // ===============================
      // Utilisateur connecté
      // ===============================
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Votre session a expiré. Merci de vous reconnecter."
        );
      }

      // ===============================
      // Résolution de l'année académique
      // ===============================
      const academicYearId =
        await resolveAcademicYearId(
          yearSelect.value
        );

      // ===============================
      // Création d'un chemin unique
      // ===============================
      const originalName = file.name || 'document';
      const lastDot = originalName.lastIndexOf('.');

      const extension =
        lastDot > 0
          ? originalName.slice(lastDot + 1)
          : '';

      const uniqueName =
        `${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 10)}` +
        (extension ? `.${extension}` : '');

      const filePath = `documents/${uniqueName}`;
      const storageBucket = 'jeap-docs';

      // ===============================
      // Upload Storage
      // ===============================
      const {
        error: storageError
      } = await supabase.storage
        .from(storageBucket)
        .upload(filePath, file);

      if (storageError) {
        throw storageError;
      }

      // ===============================
      // URL publique
      // ===============================
      const {
        data: publicUrlData
      } = supabase.storage
        .from(storageBucket)
        .getPublicUrl(filePath);

      const fileUrl =
        publicUrlData?.publicUrl || null;

      // ===============================
      // Enregistrement en base
      // ===============================
      const {
        error: dbError
      } = await supabase
        .from('documents')
        .insert([
          {
            title,
            subject,
            faculty_id: facultySelect.value,
            program_id: programSelect.value,
            level_id: levelSelect.value,
            document_type_id: typeSelect.value,
            academic_year_id: academicYearId,

            file_url: fileUrl,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,

            // Informations nécessaires pour retrouver
            // et supprimer le fichier Storage plus tard.
            storage_bucket: storageBucket,
            storage_path: filePath,

            uploader_id: user.id
          }
        ]);

      if (dbError) {
        // Nettoyage du fichier Storage si l'insertion
        // dans la table documents échoue.
        await supabase.storage
          .from(storageBucket)
          .remove([filePath]);

        throw dbError;
      }

      // ===============================
      // Succès
      // ===============================
      showAlert(
        "Document publié avec succès !",
        "success"
      );

      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML =
          "✅ Document publié";
      }

      uploadForm.reset();
      programSelect.disabled = true;

    } catch (error) {
      console.error(error);

      if (publishBtn) {
        publishBtn.disabled = false;
        publishBtn.innerHTML =
          "📤 Publier le document";
      }

      showAlert(
        `Erreur : ${error.message}`,
        "error"
      );
    }
  });

  // ===============================
  // Messages d'alerte
  // ===============================
  function showAlert(message, type) {
    if (!alertMessage) return;

    const styles = {
      success:
        "bg-green-100 text-green-700 border border-green-200",

      error:
        "bg-red-100 text-red-700 border border-red-200",

      info:
        "bg-blue-100 text-blue-700 border border-blue-200"
    };

    alertMessage.className =
      `p-3 rounded-lg text-sm mb-4 ${
        styles[type] || styles.info
      }`;

    alertMessage.textContent = message;
    alertMessage.classList.remove('hidden');
  }

});