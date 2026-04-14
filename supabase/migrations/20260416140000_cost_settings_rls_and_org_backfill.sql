-- cost_settings: organization_id NULL satırlar RLS yüzünden hiç görünmez (NULL = get_user_org_id() false).
-- NULL değerleri Kademe ana org ile doldur; okuma politikası tüm org'ların ortak katalog satırlarını görsün.

DO $$
DECLARE
  v_kademe uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  UPDATE public.cost_settings
  SET
    organization_id = v_kademe,
    updated_at = coalesce(updated_at, now())
  WHERE organization_id IS NULL;
END $$;

-- Tek politika org_all tüm komutlara bağlıydı; SELECT ve yazma ayrıştırıldı.
DROP POLICY IF EXISTS org_all ON public.cost_settings;

-- Okuma: kendi org + Kademe ortak müdürlük kataloğu
CREATE POLICY cost_settings_select ON public.cost_settings
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_org_id()
    OR organization_id = 'a0000000-0000-0000-0000-000000000001'::uuid
  );

CREATE POLICY cost_settings_insert ON public.cost_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY cost_settings_update ON public.cost_settings
  FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_org_id())
  WITH CHECK (organization_id = public.get_user_org_id());

CREATE POLICY cost_settings_delete ON public.cost_settings
  FOR DELETE
  TO authenticated
  USING (organization_id = public.get_user_org_id());

COMMENT ON POLICY cost_settings_select ON public.cost_settings IS
  'Kendi organizasyonu + Kademe A.Ş. ortak birim/müdürlük kataloğu okunabilir.';

-- UI insert organization_id göndermiyor; RLS WITH CHECK için oturum org atansın
CREATE OR REPLACE FUNCTION public.cost_settings_bi_set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_org_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cost_settings_set_org ON public.cost_settings;
CREATE TRIGGER tr_cost_settings_set_org
  BEFORE INSERT ON public.cost_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.cost_settings_bi_set_organization_id();
