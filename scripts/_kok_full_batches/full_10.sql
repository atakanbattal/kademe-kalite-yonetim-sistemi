WITH x AS (
  SELECT * FROM (VALUES
  (E'DF-2026-070'::text, E'DF'::text, E'26-003 numarali is kazasi igin aksiyon alinmalidir .'::text, E'İş kazası (DF-İK-2026-003) yaşanmış; çalışan yaralanmış ya da tehlikeli durum oluşmuştur.'::text, E'Çalışan iş sırasında bir kaza geçirmiştir.'::text, E'Güvensiz hareket veya çalışma koşulu kaza oluşumunu tetiklemiştir.'::text, E'KKD (kişisel koruyucu donanım) kullanımı veya güvenli çalışma talimatı yeterince uygulanmamıştır.'::text, E'İSG eğitiminin etkinliği ölçülmemekte; uygulamada sapma tespit mekanizması kurulmamıştır.'::text, E'İş güvenliği denetim sıklığı ve sahada anlık risk takibi yetersiz; kazayı önleyecek davranışsal güvenlik programı oluşturulmamıştır.'::text, E'26-003 numarali is kazasi igin aksiyon alinmalidir .'::text, E'Ust Yapi'::text, E'25.04.2026'::text, E'Ust Yapi'::text, E'İş kazası (26-003): Risk Değerlendirmesi güncel olmayabilir veya uygulamada sapma var'::text, E'İş kazası bildirimi veya güvensiz durum tespiti ile kayıt altına alınmıştır.'::text, E'1. Kaza 26-003 için detaylı Kaza Kök Neden Analizi yapılmalı (5 Neden veya SCAT yöntemi); bulgular belgeli hale getirilmelidir.\n2. Kazanın gerçekleştiği alan/proses için Risk Değerlendirmesi revize edilmeli; yeni kontrol önlemleri tanımlanmalı ve hayata geçirilmelidir.\n3. Tüm hat/saha personeline olay konusunda güvenlik brifing\'i verilmeli; imzalı katılım formu tutulmalıdır.\n4. Benzer kaza riski taşıyan diğer alanlar/prosesler değerlendirilmeli (yatay yayılım kontrolü); gerekirse fiziksel bariyer/ikaz levhası eklenmelidir.'::text),
  (E'DF-2026-071'::text, E'DF'::text, E'26-004 numarali is kazasi igin aksiyon alinmasi gerekmektedir .'::text, E'İş kazası (DF-İK-2026-004) yaşanmış; çalışan yaralanmış ya da tehlikeli durum oluşmuştur.'::text, E'Çalışan iş sırasında bir kaza geçirmiştir.'::text, E'Kaza anındaki çalışma yöntemi veya ekipman güvenli kullanım standardına uymamaktadır.'::text, E'Güvenli çalışma prosedürü ya çalışana iletilmemiş ya da anlaşılır değildir.'::text, E'Güvenli prosedür bilinse de gözetim eksikliği nedeniyle uygulanmamıştır.'::text, E'Bu aktivite için güvenli iş prosedürü (SOP) ve denetim planı oluşturulmamış; kaza önleme kültürü ve hesap verebilirlik mekanizması eksiktir.'::text, E'26-004 numarali is kazasi igin aksiyon alinmasi gerekmektedir .'::text, E'Ust Yapi'::text, E'25.04.2026'::text, E'Ust Yapi'::text, E'İş kazası (26-004): Risk Değerlendirmesi güncel olmayabilir veya uygulamada sapma var'::text, E'İş kazası bildirimi veya güvensiz durum tespiti ile kayıt altına alınmıştır.'::text, E'1. Kaza 26-004 için detaylı Kaza Kök Neden Analizi yapılmalı (5 Neden veya SCAT yöntemi); bulgular belgeli hale getirilmelidir.\n2. Kazanın gerçekleştiği alan/proses için Risk Değerlendirmesi revize edilmeli; yeni kontrol önlemleri tanımlanmalı ve hayata geçirilmelidir.\n3. Tüm hat/saha personeline olay konusunda güvenlik brifing\'i verilmeli; imzalı katılım formu tutulmalıdır.\n4. Benzer kaza riski taşıyan diğer alanlar/prosesler değerlendirilmeli (yatay yayılım kontrolü); gerekirse fiziksel bariyer/ikaz levhası eklenmelidir.'::text)
  ) AS t(nc_number, typ, problem_def, symptom, why1, why2, why3, why4, why5, ne, nerede, ne_zaman, kim, neden, nasil, actions_text)
)
UPDATE non_conformities n
SET
  five_n1k_analysis = jsonb_build_object(
    'ne', to_jsonb(x.ne),
    'nerede', to_jsonb(x.nerede),
    'neZaman', to_jsonb(x.ne_zaman),
    'kim', to_jsonb(x.kim),
    'neden', to_jsonb(x.neden),
    'nasil', to_jsonb(x.nasil)
  ),
  five_why_analysis = jsonb_build_object(
    'problem', to_jsonb(x.problem_def),
    'why1', to_jsonb(x.why1),
    'why2', to_jsonb(x.why2),
    'why3', to_jsonb(x.why3),
    'why4', to_jsonb(x.why4),
    'why5', to_jsonb(x.why5),
    'rootCause', to_jsonb(x.why5),
    'immediateAction', to_jsonb(x.neden),
    'preventiveAction', to_jsonb(x.actions_text)
  ),
  eight_d_steps = CASE
    WHEN n.type = '8D' THEN
      jsonb_set(
        jsonb_set(
          COALESCE(n.eight_d_steps, '{}'::jsonb),
          '{D4,description}',
          to_jsonb(
            ('5 Neden (özet)'::text || E'\n\n' ||
             '1. ' || x.why1 || E'\n' ||
             '2. ' || x.why2 || E'\n' ||
             '3. ' || x.why3 || E'\n' ||
             '4. ' || x.why4 || E'\n' ||
             '5 (Kök): ' || x.why5)::text
          ),
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
