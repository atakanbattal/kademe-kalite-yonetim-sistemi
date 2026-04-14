-- equipment_assignments uses assigned_personnel_id (not personnel_id).
-- Fixes: column ea.personnel_id does not exist when triggers run on equipment_calibrations.

CREATE OR REPLACE FUNCTION create_task_for_calibration()
RETURNS TRIGGER AS $$
DECLARE
    v_task_id UUID;
    v_responsible_personnel_id UUID;
    v_equipment_name TEXT;
    v_days_until_due INTEGER;
    v_task_title TEXT;
    v_task_description TEXT;
BEGIN
    IF NEW.is_active = false THEN
        RETURN NEW;
    END IF;

    IF NEW.next_calibration_date IS NULL THEN
        RETURN NEW;
    END IF;

    v_days_until_due := EXTRACT(DAY FROM (NEW.next_calibration_date - NOW()))::INTEGER;

    IF v_days_until_due <= 30 THEN
        SELECT name INTO v_equipment_name
        FROM equipments
        WHERE id = NEW.equipment_id;

        SELECT p.id INTO v_responsible_personnel_id
        FROM personnel p
        JOIN equipments e ON e.responsible_unit = p.department
        WHERE e.id = NEW.equipment_id
        LIMIT 1;

        IF v_responsible_personnel_id IS NULL THEN
            SELECT ea.assigned_personnel_id INTO v_responsible_personnel_id
            FROM equipment_assignments ea
            WHERE ea.equipment_id = NEW.equipment_id
              AND ea.is_active = true
            LIMIT 1;
        END IF;

        IF v_responsible_personnel_id IS NULL THEN
            RETURN NEW;
        END IF;

        SELECT t.id INTO v_task_id
        FROM tasks t
        JOIN task_assignees ta ON ta.task_id = t.id
        WHERE t.title LIKE '%' || COALESCE(v_equipment_name, '') || '%'
          AND t.title LIKE '%Kalibrasyon%'
          AND ta.personnel_id = v_responsible_personnel_id
          AND t.status NOT IN ('Tamamlandı', 'İptal')
        LIMIT 1;

        IF v_task_id IS NULL THEN
            v_task_title := format('Kalibrasyon: %s', COALESCE(v_equipment_name, 'Ekipman'));

            v_task_description := format('Ekipman kalibrasyonu %s.%s%s',
                CASE
                    WHEN v_days_until_due < 0 THEN format('%s gün gecikmiş', ABS(v_days_until_due))
                    WHEN v_days_until_due = 0 THEN 'bugün'
                    ELSE format('%s gün sonra', v_days_until_due)
                END,
                CASE WHEN NEW.next_calibration_date IS NOT NULL THEN
                    E'\n\nKalibrasyon Tarihi: ' || TO_CHAR(NEW.next_calibration_date, 'DD.MM.YYYY')
                ELSE '' END,
                CASE WHEN v_equipment_name IS NOT NULL THEN
                    E'\n\nEkipman: ' || v_equipment_name
                ELSE '' END
            );

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
                    WHEN v_days_until_due < 0 THEN 'Kritik'
                    WHEN v_days_until_due <= 7 THEN 'Yüksek'
                    ELSE 'Orta'
                END,
                NEW.next_calibration_date,
                NOW()
            ) RETURNING id INTO v_task_id;

            IF v_task_id IS NOT NULL THEN
                INSERT INTO task_assignees (task_id, personnel_id, assigned_at)
                VALUES (v_task_id, v_responsible_personnel_id, NOW())
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Kalibrasyon görevi oluşturulamadı: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_calibration_due()
RETURNS TRIGGER AS $$
DECLARE
    v_days_until_due INTEGER;
    v_responsible_user_id UUID;
    v_equipment_name TEXT;
BEGIN
    IF NEW.is_active = false THEN
        RETURN NEW;
    END IF;

    IF NEW.next_calibration_date IS NULL THEN
        RETURN NEW;
    END IF;

    v_days_until_due := EXTRACT(DAY FROM (NEW.next_calibration_date - NOW()))::INTEGER;

    IF v_days_until_due <= 30 THEN
        SELECT name INTO v_equipment_name
        FROM equipments
        WHERE id = NEW.equipment_id;

        SELECT array_agg(u.id) INTO v_responsible_user_id
        FROM auth.users u
        JOIN personnel p ON p.email = u.email
        JOIN equipments e ON e.responsible_unit = p.department
        WHERE e.id = NEW.equipment_id
        LIMIT 1;

        IF v_responsible_user_id IS NULL THEN
            SELECT array_agg(DISTINCT u.id) INTO v_responsible_user_id
            FROM auth.users u
            JOIN personnel p ON p.email = u.email
            JOIN equipment_assignments ea ON ea.assigned_personnel_id = p.id
            WHERE ea.equipment_id = NEW.equipment_id AND ea.is_active = true;
        END IF;

        IF v_responsible_user_id IS NOT NULL THEN
            PERFORM create_notification(
                v_responsible_user_id,
                CASE
                    WHEN v_days_until_due < 0 THEN 'CALIBRATION_DUE'
                    ELSE 'CALIBRATION_DUE'
                END,
                format('Kalibrasyon %s: %s',
                    CASE WHEN v_days_until_due < 0 THEN 'Gecikmiş' ELSE 'Yaklaşıyor' END,
                    COALESCE(v_equipment_name, 'Ekipman')),
                format('%s ekipmanının kalibrasyonu %s gün %s.',
                    COALESCE(v_equipment_name, 'Ekipman'),
                    ABS(v_days_until_due),
                    CASE WHEN v_days_until_due < 0 THEN 'geçmiş' ELSE 'kaldı' END),
                'equipment',
                NEW.equipment_id,
                CASE
                    WHEN v_days_until_due < 0 THEN 'HIGH'
                    WHEN v_days_until_due <= 7 THEN 'HIGH'
                    ELSE 'NORMAL'
                END,
                format('/equipment?equipment_id=%s', NEW.equipment_id)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
