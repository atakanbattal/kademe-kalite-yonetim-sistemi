-- Demo: Binzel ABIMIG A 405 LW vs DINSE MZ 304.PLUS

DO $$
DECLARE
  b_torch  uuid := gen_random_uuid();
  bn_torch text;
BEGIN
  SELECT public.generate_benchmark_number() INTO bn_torch;

  INSERT INTO public.benchmarks (
    id, benchmark_number, category_id, title, description, status, priority,
    objective, scope, currency, tags, notes
  ) VALUES (
    b_torch,
    bn_torch,
    '4c7c9729-72d9-4a0f-8bb7-65715ac6d967'::uuid,
    'MIG/MAG kaynak torcu: ABICOR BINZEL ABIMIG A 405 LW vs DINSE MZ 304.PLUS',
    'Hava soğutmalı hafif endüstriyel torç (Binzel Bikox LW) ile sıvı soğutmalı yüksek akım torç (Dinse MZ serisi) karşılaştırması. Kaynak: Binzel ABIMIG A LW teknik tablo (EN 60974-7); Dinse MZ 304.PLUS satıcı teknik özeti (500 A CO2 / 450 A karışık gaz, 60% ED).',
    'Devam Ediyor',
    'Normal',
    'Ağır kaynak ile hafif ergonomik torç arasında iş istasyonu ve süreklilik ihtiyacına göre seçim.',
    '4 m kablo, Euro bağlantı; endüstriyel MIG/MAG. Karşılaştırma: nominal akım, görev döngüsü, soğutma tipi, kütle.',
    'TRY',
    ARRAY['MIG', 'MAG', 'torç', 'Binzel', 'ABIMIG', 'Dinse', 'MZ304'],
    'Referanslar: binzel-abicor.com ABIMIG A LW; valtec-shop / üretici özetleri MZ 304.PLUS su soğutmalı.'
  );

  INSERT INTO public.benchmark_items (
    benchmark_id, item_name, item_code, description, manufacturer, model_number,
    specifications, unit_price, currency, minimum_order_quantity, lead_time_days,
    quality_score, performance_score, reliability_score,
    delivery_time_days, warranty_period_months,
    ease_of_use_score, energy_efficiency_score, environmental_impact_score,
    market_reputation_score, innovation_score, compatibility_score,
    documentation_quality_score, technical_support_score, after_sales_service_score,
    total_cost_of_ownership, roi_percentage, risk_level,
    rank_order, is_current_solution, is_recommended, notes
  ) VALUES
  (
    b_torch,
    'ABICOR BINZEL ABIMIG A 405 LW',
    '015.D071.1',
    'Hava soğutmalı MIG/MAG torç; Bikox LW kablo ile düşük kütle. EN 60974-7: CO2 400 A, M21 350 A, %60 GD; tel 1,0-1,6 mm. Yaklaşık 2,8 kg (4 m).',
    'ABICOR BINZEL',
    'ABIMIG A 405 LW',
    jsonb_build_object(
      'cooling', 'Hava',
      'rating_A', jsonb_build_object('CO2', 400, 'M21_mixed', 350),
      'duty_cycle_pct', 60,
      'wire_diameter_mm', '1.0-1.6',
      'weight_kg_typical', 2.8,
      'cable_length_m', 4,
      'features', jsonb_build_array('Bikox LW', 'Euro bağlantı', 'GRIP ergonomik sap'),
      'source_ref', 'binzel-abicor.com ABIMIG A LW; Stokker ürün ağırlığı'
    ),
    18500.00,
    'TRY',
    1,
    14,
    94, 88, 93,
    14, 12,
    96, 78, 85,
    96, 90, 98,
    92, 95, 94,
    22000, 18,
    'Düşük',
    1, true, true,
    'Orta-yüksek akım hava soğutma; ergonomi ve kütle için güçlü; sürekli 500 A+ iş için su soğutma alternatifi değerlendirilmeli.'
  ),
  (
    b_torch,
    'DINSE MZ 304.PLUS (4 m, su soğutmalı)',
    '625011304040',
    'Endüstriyel su soğutmalı MIG torç; yüksek termal yük. Özet: ~500 A CO2, ~450 A karışık gaz, %60 ED; tel 0,8-1,6 mm; Euro; çift devre soğutma (üretici / satıcı teknik özet).',
    'DINSE',
    'MZ 304.PLUS',
    jsonb_build_object(
      'cooling', 'Su (çift devre)',
      'rating_A', jsonb_build_object('CO2_max', 500, 'mixed_gas_typical', 450),
      'duty_cycle_pct', 60,
      'wire_diameter_mm', '0.8-1.6',
      'hose_length_m', 4,
      'connector', 'Euro',
      'features', jsonb_build_array('Yüksek akım', 'Ayrı koruyucu gaz kanalı', 'Endüstriyel süreklilik'),
      'source_ref', 'dinse.eu / valtec-shop MZ 304.PLUS teknik özet'
    ),
    22000.00,
    'TRY',
    1,
    21,
    93, 96, 94,
    21, 12,
    82, 88, 82,
    90, 85, 96,
    88, 90, 91,
    28000, 15,
    'Orta',
    2, false, false,
    'Ağır kaynak ve uzun süreli yüksek akım için uygun; su soğutma altyapısı ve maliyet gerektirir.'
  );
END;
$$;
