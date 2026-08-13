-- ========================================================
-- 1. NETTOYAGE COMPLET DU SCHÉMA PUBLIC (RESET)
-- ========================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restauration des droits standard de Supabase
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;

-- ========================================================
-- 2. EXTENSIONS & TYPES (ENUMS)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('student', 'moderator', 'admin');
CREATE TYPE user_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE doc_status AS ENUM ('published', 'hidden');
CREATE TYPE report_status AS ENUM ('open', 'resolved', 'dismissed');

-- ========================================================
-- 3. STRUCTURE DES TABLES (SCHÉMA ACADÉMIQUE & APP)
-- ========================================================

-- Profils utilisateurs (extension de auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role user_role DEFAULT 'student'::user_role NOT NULL,
  status user_status DEFAULT 'pending'::user_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Support des lettres, tirets, espaces ET apostrophes (ex: D'Almeida)
  CONSTRAINT check_first_name CHECK (first_name ~* '^[a-zA-ZÀ-ÿ\s\''\-]+$'),
  CONSTRAINT check_last_name CHECK (last_name ~* '^[a-zA-ZÀ-ÿ\s\''\-]+$')
);

-- Années académiques
CREATE TABLE public.academic_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year_label TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Facultés / Écoles
CREATE TABLE public.faculties (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('faculte', 'ecole_institut')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Filières
CREATE TABLE public.programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE CASCADE NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Niveaux d'études
CREATE TABLE public.levels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL
);

-- Types de documents
CREATE TABLE public.document_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL
);

-- Table principale des documents
CREATE TABLE public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  faculty_id UUID REFERENCES public.faculties(id) NOT NULL,
  program_id UUID REFERENCES public.programs(id) NOT NULL,
  level_id UUID REFERENCES public.levels(id) NOT NULL,
  document_type_id UUID REFERENCES public.document_types(id) NOT NULL,
  academic_year_id UUID REFERENCES public.academic_years(id) NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL, -- Passage à BIGINT pour supporter les gros volumes
  mime_type TEXT NOT NULL,
  uploader_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status doc_status DEFAULT 'published'::doc_status NOT NULL,
  downloads_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Signalements
CREATE TABLE public.document_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status report_status DEFAULT 'open'::report_status NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Actualités JEAP
CREATE TABLE public.news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Journal d'audit
CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ========================================================
-- 4. FONCTIONS, TRIGGERS & INDEXES
-- ========================================================

-- Trigger de mise à jour de updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger d'inscription utilisateur sécurisé avec nettoyage Regex
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  clean_first_name TEXT;
  clean_last_name TEXT;
BEGIN
  clean_first_name := REGEXP_REPLACE(COALESCE(new.raw_user_meta_data->>'first_name', 'Prenom'), '[^a-zA-ZÀ-ÿ\s\''\-]', '', 'g');
  clean_last_name := REGEXP_REPLACE(COALESCE(new.raw_user_meta_data->>'last_name', 'Nom'), '[^a-zA-ZÀ-ÿ\s\''\-]', '', 'g');

  IF clean_first_name = '' THEN clean_first_name := 'Prenom'; END IF;
  IF clean_last_name = '' THEN clean_last_name := 'Nom'; END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, role, status)
  VALUES (
    new.id,
    new.email,
    clean_first_name,
    clean_last_name,
    'student'::user_role,
    'pending'::user_status
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes de performance pour la recherche et les filtres
CREATE INDEX idx_documents_faculty_id ON public.documents(faculty_id);
CREATE INDEX idx_documents_program_id ON public.documents(program_id);
CREATE INDEX idx_documents_level_id ON public.documents(level_id);
CREATE INDEX idx_documents_status ON public.documents(status);
CREATE INDEX idx_profiles_role_status ON public.profiles(role, status);

-- ========================================================
-- 5. DONNÉES PAR DÉFAUT (SEEDS)
-- ========================================================

INSERT INTO public.academic_years (year_label, is_active) VALUES ('2026-2027', true);

INSERT INTO public.levels (code, label, sort_order) VALUES
('L1', 'Licence 1', 1),
('L2', 'Licence 2', 2),
('L3', 'Licence 3', 3),
('M1', 'Master 1', 4),
('M2', 'Master 2', 5);

INSERT INTO public.document_types (code, label) VALUES
('cours', 'Support de cours'),
('epreuve', 'Épreuve / Examen'),
('corrige', 'Corrigé-type'),
('td_tp', 'Travaux Dirigés / Pratiques'),
('memoire', 'Mémoire / Rapport de stage');

DO $$
DECLARE
  v_fa UUID; v_faseg UUID; v_fdsp UUID; v_flash UUID; v_fm UUID;
  v_iut UUID; v_enspd UUID; v_ifsio UUID; v_ensagap UUID; v_enatse UUID; v_ensap UUID;
BEGIN
  INSERT INTO public.faculties (code, name, type) VALUES ('FA', 'Faculté d''Agronomie', 'faculte') RETURNING id INTO v_fa;
  INSERT INTO public.faculties (code, name, type) VALUES ('FASEG', 'Faculté des Sciences Économiques et de Gestion', 'faculte') RETURNING id INTO v_faseg;
  INSERT INTO public.faculties (code, name, type) VALUES ('FDSP', 'Faculté de Droit et de Science Politique', 'faculte') RETURNING id INTO v_fdsp;
  INSERT INTO public.faculties (code, name, type) VALUES ('FLASH', 'Faculté des Lettres, Arts et Sciences Humaines', 'faculte') RETURNING id INTO v_flash;
  INSERT INTO public.faculties (code, name, type) VALUES ('FM', 'Faculté de Médecine', 'faculte') RETURNING id INTO v_fm;

  INSERT INTO public.faculties (code, name, type) VALUES ('IUT', 'Institut Universitaire de Technologie', 'ecole_institut') RETURNING id INTO v_iut;
  INSERT INTO public.faculties (code, name, type) VALUES ('ENSPD', 'École Nationale de la Statistique, de la Planification et de la Démographie', 'ecole_institut') RETURNING id INTO v_enspd;
  INSERT INTO public.faculties (code, name, type) VALUES ('IFSIO', 'Institut de Formation en Soins Infirmiers et Obstétricaux', 'ecole_institut') RETURNING id INTO v_ifsio;
  INSERT INTO public.faculties (code, name, type) VALUES ('ENSAGAP', 'École Nationale Supérieure d''Aménagement et de Gestion des Aires Protégées', 'ecole_institut') RETURNING id INTO v_ensagap;
  INSERT INTO public.faculties (code, name, type) VALUES ('ENATSE', 'École Nationale de Formation des Techniciens Supérieurs en Santé Publique', 'ecole_institut') RETURNING id INTO v_enatse;
  INSERT INTO public.faculties (code, name, type) VALUES ('ENSAP', 'École Nationale Supérieure Agro-Pastorale', 'ecole_institut') RETURNING id INTO v_ensap;

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_fa, 'Sciences et Techniques de Production Végétale'),
    (v_fa, 'Sciences et Techniques de Production Animale'),
    (v_fa, 'Aménagement et Gestion des Ressources Naturelles'),
    (v_fa, 'Économie et Sociologie Rurale');

  INSERT INTO public.programs (faculty_id, code, name) VALUES
    (v_faseg, 'FC', 'Finance et Comptabilité'),
    (v_faseg, 'MMO', 'Marketing et Management des Organisations'),
    (v_faseg, 'APE', 'Analyse et Politiques Économiques'),
    (v_faseg, 'EFI', 'Économie et Finance Internationale');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_fdsp, 'Droit Privé'),
    (v_fdsp, 'Droit Public'),
    (v_fdsp, 'Science Politique');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_flash, 'Géographie et Aménagement du Territoire'),
    (v_flash, 'Sociologie-Anthropologie'),
    (v_flash, 'Études Anglophones'),
    (v_flash, 'Lettres Modernes'),
    (v_flash, 'Histoire et Archéologie');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_fm, 'Médecine Générale');

  INSERT INTO public.programs (faculty_id, code, name) VALUES
    (v_iut, 'IG', 'Informatique de Gestion'),
    (v_iut, 'GB', 'Gestion des Banques'),
    (v_iut, 'GE', 'Gestion des Entreprises'),
    (v_iut, 'GC', 'Gestion Commerciale'),
    (v_iut, 'GTL', 'Gestion des Transports et Logistique'),
    (v_iut, 'GRH', 'Gestion des Ressources Humaines'),
    (v_iut, 'SIL', 'Systèmes Informatiques et Logiciels'); -- Intégration directe de la filière SIL

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_enspd, 'Statistiques Économiques et Financières'),
    (v_enspd, 'Démographie et Statistiques Sociales'),
    (v_enspd, 'Planification du Développement Local');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_ifsio, 'Soins Infirmiers'),
    (v_ifsio, 'Sciences Obstétricales');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_ensagap, 'Gestion de la Faune et des Aires Protégées'),
    (v_ensagap, 'Aménagement des Écosystèmes');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_enatse, 'Épidémiologie et Surveillance Sanitaire'),
    (v_enatse, 'Hygiène, Assainissement et Salubrité');

  INSERT INTO public.programs (faculty_id, name) VALUES
    (v_ensap, 'Productions Animales et Pastorales'),
    (v_ensap, 'Entrepreneuriat Agricole et Élevage');
END $$;

-- ========================================================
-- 6. FONCTIONS SÉCURISÉES RPC & RLS
-- ========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helpers RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'::user_role AND status = 'approved'::user_status
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'::user_status
  );
$$;

-- Incrémentation compteur de téléchargements
CREATE OR REPLACE FUNCTION public.increment_downloads(doc_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.documents SET downloads_count = downloads_count + 1 WHERE id = doc_id;
$$;

-- Statistiques publiques pour la landing page
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE (
  documents_count BIGINT,
  members_count BIGINT,
  faculties_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.documents WHERE status = 'published'),
    (SELECT COUNT(*) FROM public.profiles WHERE status = 'approved'),
    (SELECT COUNT(*) FROM public.faculties);
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- Résout un libellé d'année académique (ex. '2027-2028') en UUID, en créant
-- la ligne si elle n'existe pas encore. Utilisée par le formulaire de dépôt
-- (public/js/upload.js) pour permettre de choisir une année future qui n'a
-- pas encore été créée en base, sans donner aux membres le droit d'écrire
-- directement dans academic_years (réservé aux admins par la policy RLS).
CREATE OR REPLACE FUNCTION public.get_or_create_academic_year(p_year_label TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_year_label IS NULL OR p_year_label = '' THEN
    RAISE EXCEPTION 'year_label ne peut pas être vide';
  END IF;

  SELECT id INTO v_id FROM public.academic_years WHERE year_label = p_year_label;

  IF v_id IS NULL THEN
    INSERT INTO public.academic_years (year_label, is_active)
    VALUES (p_year_label, true)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_academic_year(TEXT) TO authenticated;

-- Politiques RLS
CREATE POLICY "Lecture publique des facultés" ON public.faculties FOR SELECT USING (true);
CREATE POLICY "Lecture publique des filières" ON public.programs FOR SELECT USING (true);
CREATE POLICY "Lecture publique des niveaux" ON public.levels FOR SELECT USING (true);
CREATE POLICY "Lecture publique des types de doc" ON public.document_types FOR SELECT USING (true);
CREATE POLICY "Lecture publique des années académiques" ON public.academic_years FOR SELECT USING (true);
CREATE POLICY "Lecture publique des actualités" ON public.news FOR SELECT USING (true);

CREATE POLICY "Lecture publique de la liste des documents" ON public.documents FOR SELECT USING (status = 'published');
CREATE POLICY "Dépôt de document réservé aux membres approuvés" ON public.documents FOR INSERT WITH CHECK (is_approved_user());
CREATE POLICY "Gestion totale des documents par Admin" ON public.documents FOR ALL USING (is_admin());

CREATE POLICY "Gestion totale des actualités par Admin" ON public.news FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Lecture profil propre utilisateur" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Création de profil lors de l'inscription" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Mise à jour profil propre utilisateur" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_admin());

CREATE POLICY "Création de signalement par membre" ON public.document_reports FOR INSERT WITH CHECK (is_approved_user());
CREATE POLICY "Lecture/Gestion signalements Admin" ON public.document_reports FOR ALL USING (is_admin());

CREATE POLICY "Gestion réservée Admin" ON public.academic_years FOR ALL USING (is_admin());
CREATE POLICY "Journal d'audit réservé Admin" ON public.audit_logs FOR ALL USING (is_admin());

-- ========================================================
-- ========================================================
-- 7. BUCKET STORAGE ET SÉCURITÉ SUR LES FICHIERS
-- ========================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('jeap-docs', 'jeap-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Suppression des anciennes politiques si elles existent déjà
DROP POLICY IF EXISTS "Lecture publique des fichiers dans jeap-docs" ON storage.objects;
DROP POLICY IF EXISTS "Upload de fichiers réservé aux membres approuvés" ON storage.objects;
DROP POLICY IF EXISTS "Gestion complète des fichiers par Admin" ON storage.objects;

-- Création des nouvelles politiques RLS Storage
CREATE POLICY "Lecture publique des fichiers dans jeap-docs" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'jeap-docs');

CREATE POLICY "Upload de fichiers réservé aux membres approuvés" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'jeap-docs' AND public.is_approved_user());

CREATE POLICY "Gestion complète des fichiers par Admin" 
ON storage.objects FOR ALL 
TO authenticated 
USING (bucket_id = 'jeap-docs' AND public.is_admin());