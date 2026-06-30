-- Doküman arşivlenmeden önce süreç akış şemasındaki kullanımları listeleme ve kaldırma

CREATE OR REPLACE FUNCTION public.get_document_process_flow_usages(p_document_id UUID)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
    WITH doc AS (
        SELECT id, document_number
        FROM public.documents
        WHERE id = p_document_id
    ),
    step_usages AS (
        SELECT
            'step_document'::text AS usage_type,
            sd.id::text AS usage_id,
            u.code AS unit_code,
            u.name AS unit_name,
            f.title AS flow_title,
            s.text AS step_text,
            sd.document_code,
            sd.section_ref,
            f.id::text AS flow_id,
            u.slug AS unit_slug
        FROM public.process_flow_step_documents sd
        JOIN public.process_flow_steps s ON s.id = sd.step_id
        JOIN public.process_flows f ON f.id = s.flow_id
        JOIN public.process_flow_units u ON u.id = f.unit_id
        CROSS JOIN doc d
        WHERE sd.document_id = d.id
           OR sd.document_code = d.document_number
    ),
    unit_key_usages AS (
        SELECT
            'unit_key_document'::text AS usage_type,
            u.id::text AS usage_id,
            u.code AS unit_code,
            u.name AS unit_name,
            NULL::text AS flow_title,
            NULL::text AS step_text,
            code_val AS document_code,
            NULL::text AS section_ref,
            NULL::text AS flow_id,
            u.slug AS unit_slug
        FROM public.process_flow_units u
        CROSS JOIN doc d
        CROSS JOIN LATERAL unnest(u.key_document_codes) AS code_val
        WHERE code_val = d.document_number
           OR split_part(code_val, ' ', 1) = d.document_number
    ),
    flow_header_usages AS (
        SELECT
            'flow_header_document'::text AS usage_type,
            f.id::text AS usage_id,
            u.code AS unit_code,
            u.name AS unit_name,
            f.title AS flow_title,
            NULL::text AS step_text,
            code_val AS document_code,
            CASE
                WHEN code_val LIKE d.document_number || ' %'
                    THEN NULLIF(trim(substring(code_val FROM length(d.document_number) + 1)), '')
                ELSE NULL
            END AS section_ref,
            f.id::text AS flow_id,
            u.slug AS unit_slug
        FROM public.process_flows f
        JOIN public.process_flow_units u ON u.id = f.unit_id
        CROSS JOIN doc d
        CROSS JOIN LATERAL unnest(f.header_document_codes) AS code_val
        WHERE code_val = d.document_number
           OR split_part(code_val, ' ', 1) = d.document_number
    ),
    combined AS (
        SELECT * FROM step_usages
        UNION ALL
        SELECT * FROM unit_key_usages
        UNION ALL
        SELECT * FROM flow_header_usages
    )
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'usage_type', usage_type,
                'usage_id', usage_id,
                'unit_code', unit_code,
                'unit_name', unit_name,
                'flow_title', flow_title,
                'step_text', step_text,
                'document_code', document_code,
                'section_ref', section_ref,
                'flow_id', flow_id,
                'unit_slug', unit_slug
            )
            ORDER BY unit_code, flow_title NULLS LAST, step_text NULLS LAST, document_code
        ),
        '[]'::jsonb
    )
    FROM combined;
$$;

CREATE OR REPLACE FUNCTION public.remove_document_process_flow_usages(p_removals jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    item jsonb;
    removed_count integer := 0;
    v_usage_type text;
    v_usage_id uuid;
    v_document_code text;
BEGIN
    IF p_removals IS NULL OR jsonb_typeof(p_removals) <> 'array' THEN
        RETURN 0;
    END IF;

    FOR item IN SELECT value FROM jsonb_array_elements(p_removals)
    LOOP
        v_usage_type := item->>'usage_type';
        v_document_code := NULLIF(trim(item->>'document_code'), '');

        IF v_usage_type = 'step_document' THEN
            v_usage_id := (item->>'usage_id')::uuid;
            DELETE FROM public.process_flow_step_documents WHERE id = v_usage_id;
            IF FOUND THEN
                removed_count := removed_count + 1;
            END IF;

        ELSIF v_usage_type = 'unit_key_document' THEN
            v_usage_id := (item->>'usage_id')::uuid;
            IF v_document_code IS NULL THEN
                CONTINUE;
            END IF;
            UPDATE public.process_flow_units
            SET key_document_codes = COALESCE(
                (
                    SELECT array_agg(code_val ORDER BY ord)
                    FROM unnest(key_document_codes) WITH ORDINALITY AS t(code_val, ord)
                    WHERE code_val <> v_document_code
                ),
                '{}'::text[]
            )
            WHERE id = v_usage_id
              AND v_document_code = ANY(key_document_codes);
            IF FOUND THEN
                removed_count := removed_count + 1;
            END IF;

        ELSIF v_usage_type = 'flow_header_document' THEN
            v_usage_id := (item->>'usage_id')::uuid;
            IF v_document_code IS NULL THEN
                CONTINUE;
            END IF;
            UPDATE public.process_flows
            SET header_document_codes = COALESCE(
                (
                    SELECT array_agg(code_val ORDER BY ord)
                    FROM unnest(header_document_codes) WITH ORDINALITY AS t(code_val, ord)
                    WHERE code_val <> v_document_code
                ),
                '{}'::text[]
            )
            WHERE id = v_usage_id
              AND v_document_code = ANY(header_document_codes);
            IF FOUND THEN
                removed_count := removed_count + 1;
            END IF;
        END IF;
    END LOOP;

    RETURN removed_count;
END;
$$;

COMMENT ON FUNCTION public.get_document_process_flow_usages IS 'İç dokümanın süreç akış şemasındaki tüm referanslarını döndürür (adım, birim anahtar, akış başlığı)';
COMMENT ON FUNCTION public.remove_document_process_flow_usages IS 'Seçilen süreç akış şeması referanslarını kaldırır; kaldırılan kayıt sayısını döndürür';

GRANT EXECUTE ON FUNCTION public.get_document_process_flow_usages(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_document_process_flow_usages(jsonb) TO authenticated;
