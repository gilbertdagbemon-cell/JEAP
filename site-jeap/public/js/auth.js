import { supabase } from './supabaseClient.js';

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const forgotForm = document.getElementById('forgot-form');
const resetForm = document.getElementById('reset-form');
const alertBox = document.getElementById('alert-box');

// Étape 2 de l'inscription : saisie du code OTP à 6 chiffres reçu par e-mail
// (remplace le lien de confirmation cliquable, qui posait probleme avec le
// "click tracking" du fournisseur SMTP transactionnel).
const otpForm = document.getElementById('otp-form');
const otpEmailDisplay = document.getElementById('otp-email-display');
const otpResendBtn = document.getElementById('btn-otp-resend');
const signupFooterLink = document.getElementById('signup-footer-link');

function showAlert(message, isError = false) {
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `mb-4 p-3 text-xs rounded-md ${isError ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`;
  alertBox.classList.remove('hidden');
}

// Traduit/reformule les messages d'erreur bruts de Supabase Auth (souvent en
// anglais et peu explicites pour un utilisateur final francophone) en
// messages clairs et cohérents avec le reste du site.
function translateAuthError(err) {
  const raw = err?.message || '';

  if (raw.includes('security purposes')) {
    return 'Veuillez patienter quelques instants avant de réessayer.';
  }
  if (raw.includes('rate limit')) {
    return 'Trop de tentatives ont été effectuées. Merci de réessayer dans quelques minutes.';
  }
  if (raw.includes('already registered') || raw.includes('User already registered')) {
    return 'Un compte existe déjà avec cette adresse e-mail.';
  }
  if (raw.includes('Invalid login credentials')) {
    return 'E-mail ou mot de passe incorrect.';
  }
  if (raw.includes('Email not confirmed')) {
    return 'Veuillez confirmer votre adresse e-mail avant de vous connecter (vérifiez vos spams).';
  }
  if (raw.includes('Password should be at least')) {
    return 'Le mot de passe est trop court.';
  }
  if (raw.includes('same_password') || raw.includes('New password should be different')) {
    return 'Le nouveau mot de passe doit être différent de l\'ancien.';
  }
  if (raw.includes('Auth session missing') || raw.includes('Invalid Refresh Token')) {
    return 'Ce lien de réinitialisation est invalide ou a expiré. Veuillez en redemander un.';
  }
  if (raw.includes('Token has expired') || raw.includes('Invalid token')) {
    return 'Ce code est invalide ou a expiré. Vous pouvez en redemander un nouveau ci-dessous.';
  }

  return raw || 'Une erreur est survenue. Veuillez réessayer.';
}

// Bascule un bouton de soumission en état "chargement" : le désactive pour
// empêcher les double-clics / doubles soumissions, et restaure son libellé
// d'origine une fois terminé (à appeler dans un `finally`).
function setLoading(button, isLoading, loadingLabel) {
  if (!button) return () => {};
  if (isLoading) {
    button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
    button.disabled = true;
    button.textContent = loadingLabel;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalLabel || button.textContent;
  }
}

// ============================================================
// Inscription
// ============================================================
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const firstName = document.getElementById('first-name').value.trim();
    const lastName = document.getElementById('last-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPasswordInput = document.getElementById('confirm-password');
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : password;

    // Validation des critères de mot de passe (8 chars min, lettres + chiffres)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasDigit) {
      showAlert('Le mot de passe doit contenir au moins 8 caractères, incluant des lettres et des chiffres.', true);
      return;
    }

    // Vérification de la confirmation du mot de passe
    if (password !== confirmPassword) {
      showAlert('Les deux mots de passe ne correspondent pas.', true);
      return;
    }

    setLoading(submitBtn, true, 'Création en cours...');

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName }
        }
      });

      if (error) throw error;

      // Remarque : la ligne dans public.profiles est creee automatiquement
      // par le trigger handle_new_user() (SECURITY DEFINER) cote base de donnees.
      // Il ne faut PAS l'inserer une seconde fois ici, sinon erreur "duplicate key".

      showAlert(`Compte créé ! Un code à 6 chiffres a été envoyé à ${email}. Saisissez-le ci-dessous (vérifiez vos spams si besoin).`);

      // On bascule vers l'étape 2 : saisie du code OTP reçu par e-mail,
      // au lieu de faire cliquer sur un lien (qui posait probleme avec le
      // "click tracking" du fournisseur SMTP).
      if (otpForm) {
        signupForm.classList.add('hidden');
        otpForm.classList.remove('hidden');
        if (signupFooterLink) signupFooterLink.classList.add('hidden');
        if (otpEmailDisplay) otpEmailDisplay.textContent = email;
        // On mémorise l'e-mail pour la vérification du code et un éventuel renvoi.
        otpForm.dataset.email = email;
        const otpInput = document.getElementById('otp-code');
        if (otpInput) otpInput.focus();
      }
    } catch (err) {
      showAlert(translateAuthError(err), true);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ============================================================
// Inscription — étape 2 : vérification du code OTP à 6 chiffres
// ============================================================
if (otpForm) {
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = otpForm.querySelector('button[type="submit"]');
    const email = otpForm.dataset.email;
    const token = document.getElementById('otp-code').value.trim();

    if (!email) {
      showAlert('Session expirée, veuillez recommencer votre inscription.', true);
      return;
    }

    setLoading(submitBtn, true, 'Vérification...');

    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
      if (error) throw error;

      showAlert('Adresse e-mail confirmée avec succès ! Votre compte devra encore être validé par un administrateur JEAP avant de pouvoir déposer ou accéder à certains documents. Redirection...');
      otpForm.reset();
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 2000);
    } catch (err) {
      showAlert(translateAuthError(err), true);
      setLoading(submitBtn, false);
    }
  });
}

// Renvoi du code OTP (si expiré ou non reçu)
if (otpResendBtn) {
  otpResendBtn.addEventListener('click', async () => {
    const email = otpForm?.dataset.email;
    if (!email) {
      showAlert('Session expirée, veuillez recommencer votre inscription.', true);
      return;
    }

    otpResendBtn.disabled = true;
    const originalText = otpResendBtn.textContent;
    otpResendBtn.textContent = 'Envoi en cours...';

    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) throw error;
      showAlert(`Un nouveau code vient d'être envoyé à ${email}.`);
    } catch (err) {
      showAlert(translateAuthError(err), true);
    } finally {
      otpResendBtn.disabled = false;
      otpResendBtn.textContent = originalText;
    }
  });
}

// ============================================================
// Connexion
// ============================================================
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setLoading(submitBtn, true, 'Connexion en cours...');

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showAlert('Connexion réussie ! Redirection...');
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1500);
    } catch (err) {
      showAlert(translateAuthError(err), true);
      setLoading(submitBtn, false);
    }
  });
}

// ============================================================
// Mot de passe oublié — demande du lien de réinitialisation
// ============================================================
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = forgotForm.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();

    // L'URL de callback est calculée dynamiquement (plutôt que codée en dur)
    // pour fonctionner aussi bien en local qu'une fois déployée sur GitHub
    // Pages, quel que soit le sous-chemin du dépôt.
    const redirectTo = new URL('reinitialiser-mot-de-passe.html', window.location.href).href;

    setLoading(submitBtn, true, 'Envoi en cours...');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;

      // Message volontairement générique : Supabase répond de la même façon
      // que l'adresse existe ou non en base, pour ne pas permettre à un
      // attaquant de vérifier quels emails sont inscrits (anti-énumération).
      // On garde donc la même formulation ici, sans jamais indiquer si le
      // compte a été trouvé ou non.
      showAlert('Si un compte existe avec cette adresse, un lien de réinitialisation vient de vous être envoyé par e-mail. Pensez à vérifier vos spams.');
      forgotForm.reset();
    } catch (err) {
      showAlert(translateAuthError(err), true);
    } finally {
      setLoading(submitBtn, false);
    }
  });
}

// ============================================================
// Réinitialisation — définition du nouveau mot de passe
// ============================================================
if (resetForm) {
  const resetStatus = document.getElementById('reset-status');
  const submitBtn = resetForm.querySelector('button[type="submit"]');

  // Tant que la session de récupération n'est pas confirmée, le formulaire
  // reste désactivé pour éviter tout appel updateUser() sans contexte valide.
  resetForm.classList.add('hidden');
  if (submitBtn) submitBtn.disabled = true;

  let recoveryConfirmed = false;

  // supabase-js détecte automatiquement le token présent dans l'URL (hash
  // #access_token=...&type=recovery) au chargement de la page et émet
  // l'événement PASSWORD_RECOVERY une fois la session recovery établie.
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryConfirmed = true;
      resetForm.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = false;
      if (resetStatus) resetStatus.classList.add('hidden');
    }
  });

  // Filet de sécurité : si après 4 secondes aucun événement PASSWORD_RECOVERY
  // n'a été reçu (lien expiré, déjà utilisé, ou page ouverte directement sans
  // passer par l'email), on informe clairement l'utilisateur au lieu de le
  // laisser face à un formulaire silencieusement inopérant.
  setTimeout(() => {
    if (!recoveryConfirmed && resetStatus) {
      resetStatus.textContent = 'Ce lien de réinitialisation est invalide, a expiré, ou a déjà été utilisé. Veuillez en redemander un nouveau.';
      resetStatus.className = 'text-xs text-center text-red-600 mb-4';
    }
  }, 4000);

  resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    if (newPassword.length < 8 || !hasLetter || !hasDigit) {
      showAlert('Le mot de passe doit contenir au moins 8 caractères, incluant des lettres et des chiffres.', true);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert('Les deux mots de passe ne correspondent pas.', true);
      return;
    }

    setLoading(submitBtn, true, 'Mise à jour...');

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      showAlert('Mot de passe mis à jour avec succès ! Vous allez être redirigé vers la page de connexion.');
      resetForm.reset();
      resetForm.classList.add('hidden');

      // On déconnecte volontairement la session de récupération (à portée
      // limitée) et on renvoie l'utilisateur se connecter avec son nouveau
      // mot de passe, pour confirmer que celui-ci fonctionne bien.
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.href = 'connexion.html';
      }, 2000);
    } catch (err) {
      showAlert(translateAuthError(err), true);
      setLoading(submitBtn, false);
    }
  });
}

// Afficher / masquer le mot de passe (bouton oeil)
document.querySelectorAll('.toggle-password').forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    if (!input) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.setAttribute('aria-label', isHidden ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });
});