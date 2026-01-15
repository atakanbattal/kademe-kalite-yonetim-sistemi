-- Kontrol Planı Revizyon Geçmişi Tablosu
-- Bu tablo revizyon yapıldığında eski verileri saklar ve geri alma işlemini mümkün kılar

CREATE TABLE IF NOT EXISTS incoming_control_plan_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    control_plan_id UUID NOT NULL REFERENCES incoming_control_plans(id) ON DELETE CASCADE,
    
    -- Revizyon Bilgileri
    revision_number INTEGER NOT NULL,
    revision_date TIMESTAMPTZ NOT NULL,
    
    -- Eski Plan Verileri (revizyon öncesi)
    old_part_code VARCHAR(100),
    old_part_name VARCHAR(255),
    old_items JSONB DEFAULT '[]'::jsonb,
    old_file_path TEXT,
    old_file_name VARCHAR(255),
    
    -- Yeni Plan Verileri (revizyon sonrası)
    new_part_code VARCHAR(100),
    new_part_name VARCHAR(255),
    new_items JSONB DEFAULT '[]'::jsonb,
    new_file_path TEXT,
    new_file_name VARCHAR(255),
    
    -- Değişiklik Detayları (hangi alanlar değişti)
    changes JSONB DEFAULT '{}'::jsonb, -- {field: "old_value -> new_value", ...}
    changed_items JSONB DEFAULT '[]'::jsonb, -- Değişen item'ların detaylı karşılaştırması
    
    -- Revizyon Notu
    revision_note TEXT,
    
    -- Revizyon Durumu
    is_active BOOLEAN DEFAULT true, -- false ise bu revizyon geri alınmış demektir
    restored_at TIMESTAMPTZ, -- Geri alma tarihi
    
    -- Meta
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_control_plan_revisions_plan_id ON incoming_control_plan_revisions(control_plan_id);
CREATE INDEX IF NOT EXISTS idx_control_plan_revisions_revision_number ON incoming_control_plan_revisions(control_plan_id, revision_number);
CREATE INDEX IF NOT EXISTS idx_control_plan_revisions_active ON incoming_control_plan_revisions(control_plan_id, is_active);

-- Yorumlar
COMMENT ON TABLE incoming_control_plan_revisions IS 'Kontrol planı revizyon geçmişi - eski versiyonları saklar ve geri alma işlemini mümkün kılar';
COMMENT ON COLUMN incoming_control_plan_revisions.old_items IS 'Revizyon öncesi plan item''ları (JSONB)';
COMMENT ON COLUMN incoming_control_plan_revisions.new_items IS 'Revizyon sonrası plan item''ları (JSONB)';
COMMENT ON COLUMN incoming_control_plan_revisions.changes IS 'Değişen alanların özeti (JSONB)';
COMMENT ON COLUMN incoming_control_plan_revisions.changed_items IS 'Değişen item''ların detaylı karşılaştırması (JSONB)';
COMMENT ON COLUMN incoming_control_plan_revisions.is_active IS 'false ise bu revizyon geri alınmış demektir';
