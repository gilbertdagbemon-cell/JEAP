-- ========================================================
-- CORRECTIF : droits d'accès manquants sur bureau_members
-- ========================================================
-- Erreur rencontrée : "permission denied for table bureau_members"
-- lors de l'ajout ou de la suppression d'un membre depuis l'admin.
--
-- Cause : contrairement aux autres tables du projet (documents, news...),
-- qui ont hérité automatiquement des privilèges par défaut du projet
-- Supabase, la table bureau_members n'a pas reçu les droits INSERT /
-- UPDATE / DELETE pour les rôles anon/authenticated. Le SELECT
-- fonctionnait déjà (c'est pour ça que la liste des 3 membres s'affichait),
-- mais pas les autres actions.
--
-- Ce correctif accorde explicitement les droits nécessaires, en plus des
-- policies RLS déjà en place (qui, elles, restent inchangées et continuent
-- de vérifier que seul un admin approuvé peut écrire).
--
-- À exécuter une seule fois dans : Supabase > SQL Editor > New query.
-- ========================================================

GRANT SELECT ON public.bureau_members TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bureau_members TO authenticated;
