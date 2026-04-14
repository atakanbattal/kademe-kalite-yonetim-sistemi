-- İki farklı otomatik KPI (DF/8D açık kayıt vs Uygunsuzluk Yönetimi açık kayıt)
-- veritabanında yanlışlıkla aynı görünen adla kayıtlıydı; auto_kpi_id'ye göre düzelt.

UPDATE public.kpis SET
  name = 'Açık DF/8D Sayısı',
  description = 'Henüz kapatılmamış tüm DF ve 8D kayıtlarının toplam sayısı.',
  data_source = 'DF ve 8D Yönetimi',
  category = 'quality'
WHERE is_auto = true AND auto_kpi_id = 'open_non_conformities_count';

UPDATE public.kpis SET
  name = 'Açık Uygunsuzluk Sayısı',
  description = 'Henüz kapatılmamış uygunsuzluk kayıtlarının sayısı.',
  data_source = 'Uygunsuzluk Yönetimi',
  category = 'quality'
WHERE is_auto = true AND auto_kpi_id = 'open_nonconformity_count';
