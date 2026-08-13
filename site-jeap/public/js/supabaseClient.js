// js/supabaseClient.js
//
// Un seul client Supabase par page, partagé par tous les autres scripts.
// Avant : chaque fichier (nav.js, home.js, stats.js, news.js, documents.js...)
// appelait sa propre fois createClient(), ce qui créait plusieurs instances
// du client (chacune avec son propre écouteur d'état d'authentification,
// sa propre gestion de session, etc.) sur une seule et même page.
// Maintenant : un seul client créé ici, importé partout ailleurs.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
