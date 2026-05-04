WITH x(nc_number, typ, problem, root_cause, actions_text) AS (
  VALUES
  (E'DF-2026-070'::text, E'DF'::text, E'26-003 numarali is kazasi igin aksiyon alinmalidir .'::text, E'İş kazası (26-003): Risk Değerlendirmesi güncel olmayabilir veya uygulamada sapma var; kaza zinciri yeterince analiz edilmemiş.'::text, E'1. Kaza 26-003 için detaylı Kaza Kök Neden Analizi yapılmalı (5 Neden veya SCAT yöntemi); bulgular belgeli hale getirilmelidir.\n2. Kazanın gerçekleştiği alan/proses için Risk Değerlendirmesi revize edilmeli; yeni kontrol önlemleri tanımlanmalı ve hayata geçirilmelidir.\n3. Tüm hat/saha personeline olay konusunda güvenlik brifing\'i verilmeli; imzalı katılım formu tutulmalıdır.\n4. Benzer kaza riski taşıyan diğer alanlar/prosesler değerlendirilmeli (yatay yayılım kontrolü); gerekirse fiziksel bariyer/ikaz levhası eklenmelidir.'::text),
  (E'DF-2026-071'::text, E'DF'::text, E'26-004 numarali is kazasi igin aksiyon alinmasi gerekmektedir .'::text, E'İş kazası (26-004): Risk Değerlendirmesi güncel olmayabilir veya uygulamada sapma var; kaza zinciri yeterince analiz edilmemiş.'::text, E'1. Kaza 26-004 için detaylı Kaza Kök Neden Analizi yapılmalı (5 Neden veya SCAT yöntemi); bulgular belgeli hale getirilmelidir.\n2. Kazanın gerçekleştiği alan/proses için Risk Değerlendirmesi revize edilmeli; yeni kontrol önlemleri tanımlanmalı ve hayata geçirilmelidir.\n3. Tüm hat/saha personeline olay konusunda güvenlik brifing\'i verilmeli; imzalı katılım formu tutulmalıdır.\n4. Benzer kaza riski taşıyan diğer alanlar/prosesler değerlendirilmeli (yatay yayılım kontrolü); gerekirse fiziksel bariyer/ikaz levhası eklenmelidir.'::text)
)
UPDATE non_conformities n
SET
  five_why_analysis = COALESCE(n.five_why_analysis, '{}'::jsonb)
    || jsonb_build_object(
      'problem', to_jsonb(x.problem),
      'rootCause', to_jsonb(x.root_cause),
      'why5', to_jsonb(x.root_cause),
      'preventiveAction', to_jsonb(x.actions_text)
    ),
  eight_d_steps = CASE
    WHEN n.type = '8D' THEN
      jsonb_set(
        jsonb_set(
          COALESCE(n.eight_d_steps, '{}'::jsonb),
          '{D4,description}',
          to_jsonb(('Kök neden (rapor özeti)'::text || E'\n\n' || x.root_cause)::text),
          true
        ),
        '{D5,description}',
        to_jsonb(('Önerilen düzeltici faaliyetler'::text || E'\n\n' || x.actions_text)::text),
        true
      )
    ELSE n.eight_d_steps
  END,
  updated_at = now()
FROM x
WHERE n.nc_number = x.nc_number AND n.type = x.typ;
