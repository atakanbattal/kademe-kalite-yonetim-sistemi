-- DF ve 8D Yönetimi Modülü Geliştirmeleri
-- D1-D8 Otomatik Kontrol Sistemi

-- 1. eight_d_progress JSONB kolonu ekle
ALTER TABLE public.non_conformities 
ADD COLUMN IF NOT EXISTS eight_d_progress JSONB DEFAULT '{
    "D1": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D2": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D3": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D4": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D5": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D6": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D7": {"completed": false, "responsible": null, "completionDate": null, "description": null},
    "D8": {"completed": false, "responsible": null, "completionDate": null, "description": null}
}'::jsonb;

-- 2. 8D adım tamamlanma kontrolü fonksiyonu
CREATE OR REPLACE FUNCTION check_8d_step_completion(
    p_nc_id UUID,
    p_step_key TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_progress JSONB;
    v_step JSONB;
    v_step_order TEXT[] := ARRAY['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    v_current_index INTEGER;
    v_previous_step_key TEXT;
    v_previous_step JSONB;
BEGIN
    -- İlk adım her zaman erişilebilir
    IF p_step_key = 'D1' THEN
        RETURN true;
    END IF;
    
    -- Progress bilgisini al
    SELECT eight_d_progress INTO v_progress
    FROM public.non_conformities
    WHERE id = p_nc_id;
    
    IF v_progress IS NULL THEN
        RETURN false;
    END IF;
    
    -- Mevcut adımın index'ini bul
    v_current_index := array_position(v_step_order, p_step_key);
    
    IF v_current_index IS NULL OR v_current_index <= 1 THEN
        RETURN false;
    END IF;
    
    -- Önceki adımı kontrol et
    v_previous_step_key := v_step_order[v_current_index - 1];
    v_previous_step := v_progress->v_previous_step_key;
    
    -- Önceki adım tamamlanmış mı?
    IF v_previous_step IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN COALESCE((v_previous_step->>'completed')::boolean, false);
END;
$$ LANGUAGE plpgsql;

-- 3. 8D adım güncelleme fonksiyonu (otomatik kontrol ile)
CREATE OR REPLACE FUNCTION update_8d_step(
    p_nc_id UUID,
    p_step_key TEXT,
    p_responsible TEXT DEFAULT NULL,
    p_completion_date DATE DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_completed BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_progress JSONB;
    v_step JSONB;
    v_can_proceed BOOLEAN;
BEGIN
    -- Önceki adım kontrolü
    v_can_proceed := check_8d_step_completion(p_nc_id, p_step_key);
    
    IF NOT v_can_proceed AND p_step_key != 'D1' THEN
        RAISE EXCEPTION 'Önceki adım tamamlanmadan bu adıma geçilemez: %', p_step_key;
    END IF;
    
    -- Mevcut progress'i al
    SELECT eight_d_progress INTO v_progress
    FROM public.non_conformities
    WHERE id = p_nc_id;
    
    IF v_progress IS NULL THEN
        v_progress := '{}'::jsonb;
    END IF;
    
    -- Adım bilgilerini güncelle
    v_step := jsonb_build_object(
        'completed', p_completed,
        'responsible', COALESCE(p_responsible, (v_progress->p_step_key->>'responsible')),
        'completionDate', COALESCE(p_completion_date::text, (v_progress->p_step_key->>'completionDate')),
        'description', COALESCE(p_description, (v_progress->p_step_key->>'description'))
    );
    
    -- Progress'i güncelle
    v_progress := jsonb_set(v_progress, ARRAY[p_step_key], v_step);
    
    -- Veritabanını güncelle
    UPDATE public.non_conformities
    SET eight_d_progress = v_progress,
        updated_at = NOW()
    WHERE id = p_nc_id;
    
    RETURN v_progress;
END;
$$ LANGUAGE plpgsql;

-- 4. 8D revizyon sistemi için tablo
CREATE TABLE IF NOT EXISTS public.eight_d_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nc_id UUID NOT NULL REFERENCES public.non_conformities(id) ON DELETE CASCADE,
    revision_number VARCHAR(20) NOT NULL, -- 'Rev.01', 'Rev.02', etc.
    revision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    revision_reason TEXT,
    eight_d_steps JSONB, -- Tüm 8D adımlarının snapshot'ı
    eight_d_progress JSONB, -- Progress snapshot'ı
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(nc_id, revision_number)
);

-- 5. Revizyon oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION create_8d_revision(
    p_nc_id UUID,
    p_revision_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_nc RECORD;
    v_revision_number VARCHAR(20);
    v_max_revision INTEGER;
BEGIN
    -- Mevcut NC bilgilerini al
    SELECT 
        eight_d_steps,
        eight_d_progress,
        (SELECT MAX(CAST(REPLACE(revision_number, 'Rev.', '') AS INTEGER))
         FROM public.eight_d_revisions
         WHERE nc_id = p_nc_id) as max_rev
    INTO v_nc
    FROM public.non_conformities
    WHERE id = p_nc_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Uygunsuzluk kaydı bulunamadı: %', p_nc_id;
    END IF;
    
    -- Yeni revizyon numarasını belirle
    v_max_revision := COALESCE(v_nc.max_rev, 0);
    v_revision_number := 'Rev.' || LPAD((v_max_revision + 1)::TEXT, 2, '0');
    
    -- Revizyon kaydı oluştur
    INSERT INTO public.eight_d_revisions (
        nc_id,
        revision_number,
        revision_reason,
        eight_d_steps,
        eight_d_progress,
        created_by
    ) VALUES (
        p_nc_id,
        v_revision_number,
        p_revision_reason,
        v_nc.eight_d_steps,
        v_nc.eight_d_progress,
        auth.uid()
    ) RETURNING id INTO v_revision_number;
    
    RETURN v_revision_number;
END;
$$ LANGUAGE plpgsql;

-- 6. Tekrarlayan problem tespiti için fonksiyon
CREATE OR REPLACE FUNCTION detect_recurring_problem(
    p_nc_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_nc RECORD;
    v_recurring_count INTEGER;
BEGIN
    -- Mevcut NC bilgilerini al
    SELECT 
        part_code,
        root_cause,
        department,
        type
    INTO v_nc
    FROM public.non_conformities
    WHERE id = p_nc_id;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Aynı parça kodu, kök neden ve birimde son 6 ay içinde açılan NC sayısını kontrol et
    SELECT COUNT(*)
    INTO v_recurring_count
    FROM public.non_conformities
    WHERE id != p_nc_id
        AND part_code = v_nc.part_code
        AND root_cause = v_nc.root_cause
        AND department = v_nc.department
        AND type = v_nc.type
        AND opening_date >= CURRENT_DATE - INTERVAL '6 months'
        AND status != 'Kapatıldı';
    
    -- 3 veya daha fazla tekrar varsa major uygunsuzluk
    RETURN v_recurring_count >= 2; -- Mevcut kayıt dahil 3 olacak
END;
$$ LANGUAGE plpgsql;

-- 7. Major uygunsuzluk flag'i için trigger
CREATE OR REPLACE FUNCTION check_and_mark_major_nc()
RETURNS TRIGGER AS $$
DECLARE
    v_is_recurring BOOLEAN;
BEGIN
    -- Sadece 8D tipi için kontrol et
    IF NEW.type = '8D' THEN
        v_is_recurring := detect_recurring_problem(NEW.id);
        
        IF v_is_recurring THEN
            NEW.is_major := true;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı oluştur (eğer is_major kolonu yoksa ekle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'non_conformities' 
        AND column_name = 'is_major'
    ) THEN
        ALTER TABLE public.non_conformities ADD COLUMN is_major BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_check_major_nc ON public.non_conformities;
CREATE TRIGGER trigger_check_major_nc
    BEFORE INSERT OR UPDATE ON public.non_conformities
    FOR EACH ROW
    EXECUTE FUNCTION check_and_mark_major_nc();

-- 8. Index'ler
CREATE INDEX IF NOT EXISTS idx_non_conformities_eight_d_progress ON public.non_conformities USING GIN (eight_d_progress);
CREATE INDEX IF NOT EXISTS idx_eight_d_revisions_nc_id ON public.eight_d_revisions(nc_id);
CREATE INDEX IF NOT EXISTS idx_eight_d_revisions_revision_number ON public.eight_d_revisions(nc_id, revision_number);

-- 9. RLS Policies (eğer RLS aktifse)
-- RLS politikaları mevcut non_conformities tablosundaki politikaları takip eder

-- Yorumlar
COMMENT ON COLUMN public.non_conformities.eight_d_progress IS '8D adımlarının tamamlanma durumu ve detayları (JSONB)';
COMMENT ON TABLE public.eight_d_revisions IS '8D revizyon geçmişi - Her revizyon için snapshot';
COMMENT ON COLUMN public.non_conformities.is_major IS 'Tekrarlayan problemler için otomatik major uygunsuzluk işareti';

