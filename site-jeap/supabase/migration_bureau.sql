-- ========================================================
-- MIGRATION : Bureau exécutif dynamique
-- ========================================================
-- Ce script est ADDITIF : contrairement à schema.sql (qui fait un
-- DROP SCHEMA CASCADE et repart de zéro), celui-ci peut être exécuté
-- en toute sécurité sur une base Supabase déjà en production, sans
-- perdre les utilisateurs, documents ou actualités existants.
--
-- À exécuter une seule fois dans : Supabase > SQL Editor > New query.
--
-- Objectif : permettre de gérer les membres du bureau (photo, nom,
-- poste, email, WhatsApp, Facebook) depuis le panneau d'administration
-- du site plutôt qu'en modifiant le code HTML chaque année. Ces mêmes
-- informations alimentent aussi les blocs Email / WhatsApp / Facebook
-- de la page Contact, pour n'avoir qu'un seul endroit à mettre à jour.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.bureau_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  role_label TEXT NOT NULL,
  photo_url TEXT,
  email TEXT,
  whatsapp_phone TEXT,      -- format international sans "+" ni espaces, ex: 22901661090
  facebook_url TEXT,
  facebook_label TEXT,      -- ex: "Profil Facebook", "Messenger - Danielle"
  academic_year TEXT NOT NULL DEFAULT '2026-2027',
  sort_order INT DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bureau_members_active_sort
  ON public.bureau_members(is_active, sort_order);

-- Trigger updated_at (réutilise la fonction déjà créée par schema.sql)
DROP TRIGGER IF EXISTS update_bureau_members_updated_at ON public.bureau_members;
CREATE TRIGGER update_bureau_members_updated_at
  BEFORE UPDATE ON public.bureau_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS : même politique que la table "news"
-- (lecture publique, gestion totale réservée aux admins approuvés)
ALTER TABLE public.bureau_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique du bureau exécutif" ON public.bureau_members;
CREATE POLICY "Lecture publique du bureau exécutif"
  ON public.bureau_members FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Gestion totale du bureau par Admin" ON public.bureau_members;
CREATE POLICY "Gestion totale du bureau par Admin"
  ON public.bureau_members FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Droits d'accès explicites sur la table. Contrairement aux tables créées
-- dans schema.sql, qui héritent des privilèges par défaut configurés au
-- niveau du projet Supabase, une table ajoutée séparément via ce script
-- additif peut ne pas en hériter correctement selon la configuration du
-- projet. On accorde donc explicitement les droits nécessaires ; les
-- policies RLS ci-dessus restent la seule barrière de sécurité réelle
-- (ces GRANT ouvrent juste l'accès de base, RLS filtre ensuite qui peut
-- vraiment lire/écrire quoi).
GRANT SELECT ON public.bureau_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bureau_members TO authenticated;

-- Remarque stockage des photos : aucune nouvelle policy Storage n'est
-- nécessaire. Les photos seront déposées dans le bucket "jeap-docs"
-- existant, sous le préfixe "bureau/" (comme les images d'actualités
-- sont déjà déposées sous "news/"). Les policies définies dans
-- schema.sql pour ce bucket (lecture publique, écriture réservée aux
-- membres approuvés/admin) couvrent déjà ce nouveau préfixe.

-- ========================================================
-- DONNÉES INITIALES (reprend la composition actuelle codée en dur
-- dans le HTML, pour ne rien perdre lors du passage au dynamique).
-- Les emails/WhatsApp/Facebook viennent de l'ancienne page contact.html.
-- ========================================================

INSERT INTO public.bureau_members
  (full_name, role_label, photo_url, email, whatsapp_phone, facebook_url, facebook_label, academic_year, sort_order)
VALUES
  (
    'AKPO Mawutondji Alban', 'Président(e)',
    NULL, -- à re-uploader depuis l'admin (l'ancienne photo public/assets/images/bureau/president.png peut être ré-uploadée telle quelle)
    'akpomawutondjialban@gmail.com', '229166109045',
    'https://www.facebook.com/profile.php?id=61578592607075', 'Profil Facebook',
    '2026-2027', 1
  ),
  (
    'GNANCADJA Moise', 'Secrétaire Général(e)',
    NULL,
    'moiseffsetongnacadja@gmail.com', '229191169764',
    NULL, NULL,
    '2026-2027', 2
  ),
  (
    'LAINE Danielle', 'Trésorier(ère)',
    NULL,
    'danielle535@gmail.com', '229193415926',
    'https://m.me/danielle.laine.2025', 'Messenger',
    '2026-2027', 3
  )
ON CONFLICT DO NOTHING;

-- Le deuxième lien Facebook générique de l'ancienne page contact.html
-- (https://www.facebook.com/profile.php?id=61585744381879, sans nom associé
-- à un membre précis) n'a pas pu être rattaché automatiquement à une
-- personne : ajoute-le manuellement au bon membre via le panneau admin
-- si besoin, ou crée une entrée "Page JEAP" dédiée.
