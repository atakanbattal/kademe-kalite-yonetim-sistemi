-- Dış kaynaklı dokümanlar (yasal mevzuat, standartlar, müşteri, tedarikçi)

CREATE TABLE IF NOT EXISTS public.external_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN (
    'yasal_mevzuat',
    'standartlar',
    'musteri_dokumanlari',
    'tedarikci_kataloglari'
  )),
  title text NOT NULL,
  description text,
  reference_code text,
  source_publisher text,
  audit_standard_id uuid REFERENCES public.audit_standards(id) ON DELETE SET NULL,
  standard_title text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  received_at date,
  valid_until date,
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  file_size bigint,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_documents_category ON public.external_documents(category);
CREATE INDEX IF NOT EXISTS idx_external_documents_customer ON public.external_documents(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_documents_supplier ON public.external_documents(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_documents_created ON public.external_documents(created_at DESC);

COMMENT ON TABLE public.external_documents IS 'Dış kaynaklı dokümanlar (mevzuat, standart, müşteri, tedarikçi katalogları)';

CREATE OR REPLACE FUNCTION public.set_external_documents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_external_documents_updated_at ON public.external_documents;
CREATE TRIGGER trg_external_documents_updated_at
  BEFORE UPDATE ON public.external_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_external_documents_updated_at();

ALTER TABLE public.external_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "external_documents_select_authenticated" ON public.external_documents;
DROP POLICY IF EXISTS "external_documents_insert_authenticated" ON public.external_documents;
DROP POLICY IF EXISTS "external_documents_update_authenticated" ON public.external_documents;
DROP POLICY IF EXISTS "external_documents_delete_authenticated" ON public.external_documents;

CREATE POLICY "external_documents_select_authenticated"
  ON public.external_documents FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "external_documents_insert_authenticated"
  ON public.external_documents FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "external_documents_update_authenticated"
  ON public.external_documents FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "external_documents_delete_authenticated"
  ON public.external_documents FOR DELETE TO authenticated
  USING (true);

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'external_documents'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.external_documents;
  END IF;
END $$;
