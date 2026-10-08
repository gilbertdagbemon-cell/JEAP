-- ========================================================
-- JEAP
-- ÉTAPE 1 : PERFORMANCE ET SÉCURITÉ DES DOCUMENTS
-- Migration non destructive
-- ========================================================


-- ========================================================
-- 1. INDEX POUR LE CHARGEMENT DES DOCUMENTS
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_documents_created_at_desc
ON public.documents (created_at DESC);


CREATE INDEX IF NOT EXISTS idx_documents_status_created_at_desc
ON public.documents (
  status,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_documents_faculty_created_at_desc
ON public.documents (
  faculty_id,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_documents_program_created_at_desc
ON public.documents (
  program_id,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_documents_level_created_at_desc
ON public.documents (
  level_id,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_documents_type_created_at_desc
ON public.documents (
  document_type_id,
  created_at DESC
);


CREATE INDEX IF NOT EXISTS idx_documents_academic_year_created_at_desc
ON public.documents (
  academic_year_id,
  created_at DESC
);


-- ========================================================
-- 2. INDEX POUR LES DOCUMENTS LES PLUS TÉLÉCHARGÉS
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_documents_status_downloads_desc
ON public.documents (
  status,
  downloads_count DESC
);


-- ========================================================
-- 3. RECHERCHE RAPIDE PAR TITRE
-- ========================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;


CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
ON public.documents
USING gin (title gin_trgm_ops);


-- ========================================================
-- 4. INDEX DES FILIÈRES
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_programs_faculty_id
ON public.programs (faculty_id);


CREATE INDEX IF NOT EXISTS idx_programs_code
ON public.programs (code);


-- ========================================================
-- 5. INDEX DES ANNÉES ACADÉMIQUES
-- ========================================================

CREATE INDEX IF NOT EXISTS idx_academic_years_active_year
ON public.academic_years (
  is_active,
  year_label DESC
);


-- ========================================================
-- 6. NORMALISATION DES CODES DE FILIÈRES
-- ========================================================
-- Ces mises à jour donnent un code aux filières qui n'en
-- avaient pas dans les données initiales.
--
-- Elles ne créent aucune nouvelle filière et ne suppriment
-- aucune donnée.


UPDATE public.programs
SET code = 'STPV'
WHERE name = 'Sciences et Techniques de Production Végétale'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'STPA'
WHERE name = 'Sciences et Techniques de Production Animale'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'AGRN'
WHERE name = 'Aménagement et Gestion des Ressources Naturelles'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'ESR'
WHERE name = 'Économie et Sociologie Rurale'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Droit Prive'
WHERE name = 'Droit Privé'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Droit Public'
WHERE name = 'Droit Public'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Sc Politique'
WHERE name = 'Science Politique'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'GAT'
WHERE name = 'Géographie et Aménagement du Territoire'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Socio-Anthro'
WHERE name = 'Sociologie-Anthropologie'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Anglais'
WHERE name = 'Études Anglophones'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Lettres Modernes'
WHERE name = 'Lettres Modernes'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Histoire-Archo'
WHERE name = 'Histoire et Archéologie'
  AND (code IS NULL OR code = '');


UPDATE public.programs
SET code = 'Medecine Generale'
WHERE name = 'Médecine Générale'
  AND (code IS NULL OR code = '');


-- ========================================================
-- 7. SÉCURISATION DE increment_downloads()
-- ========================================================

CREATE OR REPLACE FUNCTION public.increment_downloads(
  doc_id UUID
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.documents
  SET downloads_count = downloads_count + 1
  WHERE id = doc_id
    AND status = 'published';
$$;


REVOKE EXECUTE
ON FUNCTION public.increment_downloads(UUID)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.increment_downloads(UUID)
TO anon;


GRANT EXECUTE
ON FUNCTION public.increment_downloads(UUID)
TO authenticated;


-- ========================================================
-- 8. ANALYSE DES TABLES
-- ========================================================

ANALYZE public.documents;

ANALYZE public.programs;

ANALYZE public.faculties;

ANALYZE public.levels;

ANALYZE public.document_types;

ANALYZE public.academic_years;