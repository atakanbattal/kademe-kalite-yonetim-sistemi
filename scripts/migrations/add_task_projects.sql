-- =====================================================
-- GÖREV PROJELERİ TABLOSU MİGRASYONU
-- =====================================================
-- Bu migration, görevleri proje/konu bazında gruplamak için
-- task_projects tablosu oluşturur ve tasks tablosuna project_id
-- kolonu ekler.
-- =====================================================

-- 1. Proje tablosu oluştur
CREATE TABLE IF NOT EXISTS task_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    status TEXT DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Tamamlandı', 'Arşivlendi')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tasks tablosuna project_id kolonu ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES task_projects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. RLS politikaları
ALTER TABLE task_projects ENABLE ROW LEVEL SECURITY;

-- Herkesin projeleri okuyabilmesi için
DROP POLICY IF EXISTS "task_projects_select" ON task_projects;
CREATE POLICY "task_projects_select" ON task_projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "task_projects_insert" ON task_projects;
CREATE POLICY "task_projects_insert" ON task_projects FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "task_projects_update" ON task_projects;
CREATE POLICY "task_projects_update" ON task_projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "task_projects_delete" ON task_projects;
CREATE POLICY "task_projects_delete" ON task_projects FOR DELETE TO authenticated USING (true);

-- 4. Varsayılan projeler ekle
INSERT INTO task_projects (name, description, color) VALUES 
    ('Genel', 'Genel görevler için varsayılan proje', '#6366f1'),
    ('Kalite İyileştirme', 'Kalite iyileştirme projeleri', '#10b981'),
    ('Müşteri Şikayetleri', 'Müşteri şikayetleriyle ilgili görevler', '#ef4444'),
    ('Tedarikçi Geliştirme', 'Tedarikçi geliştirme projeleri', '#f59e0b'),
    ('İç Denetim', 'İç denetim görevleri', '#8b5cf6')
ON CONFLICT DO NOTHING;

-- 5. Updated_at trigger fonksiyonu (eğer yoksa)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Updated_at trigger
DROP TRIGGER IF EXISTS update_task_projects_updated_at ON task_projects;
CREATE TRIGGER update_task_projects_updated_at
    BEFORE UPDATE ON task_projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Başarılı tamamlandı mesajı
DO $$
BEGIN
    RAISE NOTICE 'Task Projects migration completed successfully!';
END $$;
