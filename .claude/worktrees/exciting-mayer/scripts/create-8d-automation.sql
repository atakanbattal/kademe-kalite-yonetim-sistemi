-- ============================================================================
-- DF/8D OTOMASYONLARI
-- Otomatik görev oluşturma, adım kontrolü, hatırlatıcılar
-- ============================================================================

-- 1. 8D Adımı Tamamlandığında Otomatik Görev Oluşturma
CREATE OR REPLACE FUNCTION create_task_for_8d_step()
RETURNS TRIGGER AS $$
DECLARE
    v_nc_record RECORD;
    v_responsible_personnel_id UUID;
    v_next_step_key TEXT;
    v_step_order TEXT[] := ARRAY['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    v_current_index INTEGER;
    v_task_title TEXT;
    v_task_description TEXT;
    v_task_id UUID;
BEGIN
    -- Sadece 8D tipi kayıtlar için
    IF NEW.type != '8D' THEN
        RETURN NEW;
    END IF;
    
    -- NC kaydını al
    SELECT * INTO v_nc_record
    FROM non_conformities
    WHERE id = NEW.id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- eight_d_progress kontrolü
    IF NEW.eight_d_progress IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Her adım için kontrol et
    FOREACH v_next_step_key IN ARRAY v_step_order
    LOOP
        v_current_index := array_position(v_step_order, v_next_step_key);
        
        -- Mevcut adımın durumunu kontrol et
        IF NEW.eight_d_progress ? v_next_step_key THEN
            DECLARE
                v_current_step JSONB := NEW.eight_d_progress->v_next_step_key;
                v_responsible TEXT := v_current_step->>'responsible';
                v_completed BOOLEAN := COALESCE((v_current_step->>'completed')::boolean, false);
                v_existing_task_id UUID;
            BEGIN
                -- Adım tamamlanmışsa veya sorumlu yoksa devam et
                IF v_completed OR v_responsible IS NULL OR v_responsible = '' THEN
                    CONTINUE;
                END IF;
                
                -- Önceki adım tamamlanmış mı kontrol et
                IF v_current_index > 1 THEN
                    DECLARE
                        v_previous_step_key TEXT := v_step_order[v_current_index - 1];
                        v_previous_step JSONB := NEW.eight_d_progress->v_previous_step_key;
                        v_previous_completed BOOLEAN := COALESCE((v_previous_step->>'completed')::boolean, false);
                    BEGIN
                        -- Önceki adım tamamlanmamışsa görev oluşturma
                        IF NOT v_previous_completed THEN
                            CONTINUE;
                        END IF;
                    END;
                END IF;
                
                -- Sorumlu personelin ID'sini bul
                SELECT id INTO v_responsible_personnel_id
                FROM personnel
                WHERE full_name = v_responsible OR department = v_responsible
                LIMIT 1;
                
                -- Personel bulunamazsa devam et
                IF v_responsible_personnel_id IS NULL THEN
                    CONTINUE;
                END IF;
                
                -- Bu adım için zaten görev var mı kontrol et
                SELECT t.id INTO v_existing_task_id
                FROM tasks t
                JOIN task_assignees ta ON ta.task_id = t.id
                WHERE t.title LIKE '%' || v_next_step_key || '%'
                  AND t.title LIKE '%' || COALESCE(v_nc_record.nc_number, v_nc_record.mdi_no, '') || '%'
                  AND ta.personnel_id = v_responsible_personnel_id
                  AND t.status NOT IN ('Tamamlandı', 'İptal')
                LIMIT 1;
                
                -- Görev yoksa oluştur
                IF v_existing_task_id IS NULL THEN
                    -- Görev başlığı ve açıklaması
                    v_task_title := format('%s - %s: %s', 
                        COALESCE(v_nc_record.nc_number, v_nc_record.mdi_no, '8D Kaydı'),
                        v_next_step_key,
                        CASE v_next_step_key
                            WHEN 'D1' THEN 'Ekip Oluşturma'
                            WHEN 'D2' THEN 'Problemi Tanımlama'
                            WHEN 'D3' THEN 'Geçici Önlemler Alma'
                            WHEN 'D4' THEN 'Kök Neden Analizi'
                            WHEN 'D5' THEN 'Kalıcı Düzeltici Faaliyetleri Belirleme'
                            WHEN 'D6' THEN 'Kalıcı Düzeltici Faaliyetleri Uygulama'
                            WHEN 'D7' THEN 'Tekrarlanmayı Önleme'
                            WHEN 'D8' THEN 'Ekibi Takdir Etme'
                            ELSE '8D Adımı'
                        END
                    );
                    
                    v_task_description := format('8D kaydı için %s adımını tamamlamanız gerekiyor.%s%s', 
                        v_next_step_key,
                        CASE WHEN v_nc_record.title IS NOT NULL THEN E'\n\nKayıt: ' || v_nc_record.title ELSE '' END,
                        CASE WHEN v_nc_record.description IS NOT NULL THEN E'\n\nAçıklama: ' || LEFT(v_nc_record.description, 200) ELSE '' END
                    );
                    
                    -- Görev oluştur
                    INSERT INTO tasks (
                        title,
                        description,
                        status,
                        priority,
                        due_date,
                        created_at
                    ) VALUES (
                        v_task_title,
                        v_task_description,
                        'Açık',
                        CASE 
                            WHEN v_nc_record.priority = 'Kritik' THEN 'Kritik'
                            WHEN v_nc_record.priority = 'Yüksek' THEN 'Yüksek'
                            ELSE 'Orta'
                        END,
                        COALESCE(v_nc_record.due_at, NOW() + INTERVAL '7 days'),
                        NOW()
                    ) RETURNING id INTO v_task_id;
                    
                    -- Görevi sorumluya ata
                    IF v_task_id IS NOT NULL THEN
                        INSERT INTO task_assignees (task_id, personnel_id, assigned_at)
                        VALUES (v_task_id, v_responsible_personnel_id, NOW())
                        ON CONFLICT DO NOTHING;
                    END IF;
                END IF;
            END;
        END IF;
    END LOOP;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Hata durumunda sessizce devam et (görev oluşturma kritik değil)
    RAISE WARNING '8D görev oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_create_task_for_8d_step ON non_conformities;
CREATE TRIGGER trigger_create_task_for_8d_step
    AFTER INSERT OR UPDATE OF eight_d_progress, type ON non_conformities
    FOR EACH ROW
    WHEN (NEW.type = '8D' AND NEW.eight_d_progress IS NOT NULL)
    EXECUTE FUNCTION create_task_for_8d_step();

-- ============================================================================
-- 2. 8D Adımı Tamamlandığında Sonraki Adımı Açma
-- ============================================================================
CREATE OR REPLACE FUNCTION unlock_next_8d_step()
RETURNS TRIGGER AS $$
DECLARE
    v_step_order TEXT[] := ARRAY['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    v_current_index INTEGER;
    v_next_step_key TEXT;
    v_updated_progress JSONB;
BEGIN
    -- Sadece 8D tipi kayıtlar için
    IF NEW.type != '8D' OR NEW.eight_d_progress IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Her adım için kontrol et
    FOR v_current_index IN 1..array_length(v_step_order, 1) - 1
    LOOP
        DECLARE
            v_current_step_key TEXT := v_step_order[v_current_index];
            v_current_step JSONB := NEW.eight_d_progress->v_current_step_key;
            v_current_completed BOOLEAN := COALESCE((v_current_step->>'completed')::boolean, false);
        BEGIN
            -- Mevcut adım tamamlanmışsa sonraki adımı hazırla
            IF v_current_completed THEN
                v_next_step_key := v_step_order[v_current_index + 1];
                
                -- Sonraki adım yoksa veya zaten varsa devam et
                IF v_next_step_key IS NULL OR (NEW.eight_d_progress ? v_next_step_key) THEN
                    CONTINUE;
                END IF;
                
                -- Sonraki adımı başlat (completed=false olarak)
                v_updated_progress := NEW.eight_d_progress || jsonb_build_object(
                    v_next_step_key,
                    jsonb_build_object(
                        'completed', false,
                        'responsible', NULL,
                        'completionDate', NULL,
                        'description', NULL,
                        'evidenceFiles', '[]'::jsonb
                    )
                );
                
                -- Progress'i güncelle
                NEW.eight_d_progress := v_updated_progress;
            END IF;
        END;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_unlock_next_8d_step ON non_conformities;
CREATE TRIGGER trigger_unlock_next_8d_step
    BEFORE UPDATE OF eight_d_progress ON non_conformities
    FOR EACH ROW
    WHEN (NEW.type = '8D' AND NEW.eight_d_progress IS NOT NULL)
    EXECUTE FUNCTION unlock_next_8d_step();

-- ============================================================================
-- 3. Tekrar Eden Problemler için Otomatik "Major" İşaretleme
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_recurring_problems_as_major()
RETURNS TRIGGER AS $$
DECLARE
    v_similar_nc_count INTEGER;
    v_part_code TEXT;
    v_root_cause TEXT;
BEGIN
    -- Sadece yeni kayıtlar için
    IF TG_OP != 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Parça kodu veya kök neden yoksa devam et
    v_part_code := COALESCE(NEW.part_code, NEW.part_name);
    v_root_cause := NULL;
    
    -- Kök neden analizinden kök nedeni çıkar
    IF NEW.five_why_analysis IS NOT NULL THEN
        v_root_cause := NEW.five_why_analysis->>'root_cause';
    END IF;
    
    IF NEW.ishikawa_analysis IS NOT NULL AND v_root_cause IS NULL THEN
        v_root_cause := NEW.ishikawa_analysis->>'root_cause';
    END IF;
    
    -- Benzer kayıtları say (son 6 ay içinde)
    SELECT COUNT(*) INTO v_similar_nc_count
    FROM non_conformities
    WHERE id != NEW.id
      AND status NOT IN ('Reddedildi')
      AND (
          (v_part_code IS NOT NULL AND (part_code = v_part_code OR part_name = v_part_code))
          OR (v_root_cause IS NOT NULL AND (
              (five_why_analysis->>'root_cause') = v_root_cause
              OR (ishikawa_analysis->>'root_cause') = v_root_cause
          ))
      )
      AND created_at >= NOW() - INTERVAL '6 months';
    
    -- 3 veya daha fazla benzer kayıt varsa "Major" olarak işaretle
    IF v_similar_nc_count >= 3 THEN
        -- Priority'yi güncelle (eğer daha düşükse)
        IF NEW.priority IS NULL OR NEW.priority NOT IN ('Kritik', 'Yüksek') THEN
            NEW.priority := 'Yüksek';
        END IF;
        
        -- Notes alanına ekle
        NEW.notes := COALESCE(NEW.notes, '') || E'\n\n[OTOMATIK] Bu problem son 6 ay içinde ' || 
                     v_similar_nc_count || ' kez tekrar etmiştir. Major uygunsuzluk olarak işaretlenmiştir.';
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tekrar eden problem kontrolü yapılamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_mark_recurring_problems_as_major ON non_conformities;
CREATE TRIGGER trigger_mark_recurring_problems_as_major
    BEFORE INSERT ON non_conformities
    FOR EACH ROW
    EXECUTE FUNCTION mark_recurring_problems_as_major();

-- ============================================================================
-- 4. 8D Revizyon Numarası Otomatik Artırma
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_increment_8d_revision()
RETURNS TRIGGER AS $$
DECLARE
    v_current_revision INTEGER := 0;
    v_revision_text TEXT;
BEGIN
    -- Sadece 8D tipi kayıtlar için
    IF NEW.type != '8D' THEN
        RETURN NEW;
    END IF;
    
    -- Revize edilmişse (status değişmiş ve reopened_at varsa)
    IF OLD.status IN ('Kapatıldı', 'Reddedildi') AND NEW.status = 'Açık' AND NEW.reopened_at IS NOT NULL THEN
        -- Mevcut revizyon numarasını al (notes veya description'dan)
        IF NEW.notes IS NOT NULL AND NEW.notes ~ 'Rev\.\s*(\d+)' THEN
            v_current_revision := (regexp_match(NEW.notes, 'Rev\.\s*(\d+)'))[1]::INTEGER;
        END IF;
        
        -- Revizyon numarasını artır
        v_current_revision := v_current_revision + 1;
        v_revision_text := format('Rev.%02d', v_current_revision);
        
        -- Notes'a ekle
        NEW.notes := COALESCE(NEW.notes, '') || E'\n\n[REVİZYON] ' || v_revision_text || ' - ' || 
                     TO_CHAR(NEW.reopened_at, 'DD.MM.YYYY HH24:MI');
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Revizyon numarası artırılamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS trigger_auto_increment_8d_revision ON non_conformities;
CREATE TRIGGER trigger_auto_increment_8d_revision
    BEFORE UPDATE OF status, reopened_at ON non_conformities
    FOR EACH ROW
    WHEN (NEW.type = '8D')
    EXECUTE FUNCTION auto_increment_8d_revision();

-- ============================================================================
-- Yorumlar
-- ============================================================================
COMMENT ON FUNCTION create_task_for_8d_step IS '8D adımları için otomatik görev oluşturur';
COMMENT ON FUNCTION unlock_next_8d_step IS '8D adımı tamamlandığında sonraki adımı açar';
COMMENT ON FUNCTION mark_recurring_problems_as_major IS 'Tekrar eden problemleri otomatik olarak major olarak işaretler';
COMMENT ON FUNCTION auto_increment_8d_revision IS '8D revizyon numarasını otomatik artırır';

