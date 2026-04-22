-- Tedarikçi durum kodu: Red -> Ret (UI ve raporlarla uyum)
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_status_check;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_status_check
  CHECK (status IN ('Değerlendirilmemiş', 'Onaylı', 'Askıya Alınmış', 'Red', 'Ret', 'Alternatif'));
UPDATE public.suppliers SET status = 'Ret', updated_at = now() WHERE status = 'Red';
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_status_check;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_status_check
  CHECK (status IN ('Değerlendirilmemiş', 'Onaylı', 'Askıya Alınmış', 'Ret', 'Alternatif'));
COMMENT ON COLUMN public.suppliers.status IS 'Tedarikçi durumu: Değerlendirilmemiş, Onaylı, Askıya Alınmış, Ret, Alternatif';
