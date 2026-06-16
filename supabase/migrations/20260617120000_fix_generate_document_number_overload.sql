-- PostgREST PGRST203: generate_document_number varchar/text aşırı yükleme çakışması.
-- RPC yalnızca tek aday (uuid, text, text) ile çalışmalı.

DROP FUNCTION IF EXISTS public.generate_document_number(uuid, character varying, character varying);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'generate_document_number'
      AND pg_get_function_identity_arguments(p.oid) = 'p_doc_type text'
  ) THEN
    ALTER FUNCTION public.generate_document_number(text)
      RENAME TO generate_legacy_document_number;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auto_generate_document_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
        NEW.document_number := public.generate_document_number(
            NEW.department_id,
            NEW.document_type::text,
            NEW.document_subcategory::text
        );
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_document_update_renumber()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
    IF (OLD.department_id IS DISTINCT FROM NEW.department_id)
       OR (OLD.document_type IS DISTINCT FROM NEW.document_type) THEN
        NEW.document_number := public.generate_document_number(
            NEW.department_id,
            NEW.document_type::text,
            NEW.document_subcategory::text
        );
    END IF;
    RETURN NEW;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.generate_document_number(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_document_number(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_document_number(uuid, text, text) TO anon;

COMMENT ON FUNCTION public.generate_document_number(uuid, text, text) IS
  'İç doküman numarası üretir (PostgREST RPC — tek imza)';
