DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'task_projects'
    ) AND NOT EXISTS (
        SELECT 1
        FROM public.task_projects
        WHERE lower(name) = lower('Haftalık İş Planı')
    ) THEN
        INSERT INTO public.task_projects (name, description, color, status)
        VALUES (
            'Haftalık İş Planı',
            'Haftalık iş planı görevleri için sabit proje',
            '#0ea5e9',
            'Aktif'
        );
    END IF;
END $$;
