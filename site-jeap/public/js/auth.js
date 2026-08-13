import { supabase } from './supabaseClient.js';

const signupForm = document.getElementById('signup-form');
const loginForm = document.getElementById('login-form');
const alertBox = document.getElementById('alert-box');

function showAlert(message, isError = false) {
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.className = `mb-4 p-3 text-xs rounded-md ${isError ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-green-100 text-green-700 border border-green-200'}`;
  alertBox.classList.remove('hidden');
}

// Inscription
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const firstName = document.getElementById('first-name').value.trim();
    const lastName = document.getElementById('last-name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validation des critères de mot de passe (8 chars min, lettres + chiffres)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    if (password.length < 8 || !hasLetter || !hasDigit) {
      showAlert('Le mot de passe doit contenir au moins 8 caractères, incluant des lettres et des chiffres.', true);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
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

      showAlert('Compte créé ! Vérifiez votre boîte e-mail (et vos spams) pour confirmer votre adresse via le lien reçu. Une fois confirmé, votre compte devra encore être validé par un administrateur JEAP avant de pouvoir déposer ou accéder à certains documents.');
      signupForm.reset();
    } catch (err) {
      showAlert(err.message || 'Une erreur est survenue lors de l\'inscription.', true);
    }
  });
}

// Connexion
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showAlert('Connexion réussie ! Redirection...');
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1500);
    } catch (err) {
      showAlert(err.message || 'Identifiants incorrects.', true);
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