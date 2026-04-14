-- Demo: Magmaweld MG2 vs Lincoln L-S6 (ayrı dosya — MCP boyut sınırı için)

DO $$
DECLARE
  b_wire  uuid := gen_random_uuid();
  bn_wire text;
BEGIN
  SELECT public.generate_benchmark_number() INTO bn_wire;

  INSERT INTO public.benchmarks (
    id, benchmark_number, category_id, title, description, status, priority,
    objective, scope, currency, tags, notes
  ) VALUES (
    b_wire,
    bn_wire,
    '5708a87e-8352-4ecb-bd50-e8b334d6bdb6'::uuid,
    'MAG SG2 (ER70S-6) 1,2 mm: Magmaweld MG2 vs Lincoln L-S6',
    'Aynı sınıf (AWS A5.18 ER70S-6 / MAG SG2) iki marka dolgu telinin teknik ve ticari karşılaştırması. Kaynak: Magmaweld MG2 ürün veri sayfası; Lincoln Electric L-S6 tipik mekanik ve kimyasal değerleri.',
    'Devam Ediyor',
    'Normal',
    'GMAW ile yapısal çelik kaynaklarında kullanılan 15 kg bobin tel için alternatif tedarik ve performans değerlendirmesi.',
    'Bobin: Ø 1,2 mm, 15 kg; koruyucu gaz: CO2 veya Ar/CO2 (M21/C1). Karşılaştırma alanı: tipik kaynak metali mekanikleri, bileşim, fiyat konumu.',
    'TRY',
    ARRAY['MAG', 'SG2', 'ER70S-6', 'Magmaweld', 'Lincoln', 'dolgu teli'],
    'Referanslar: magmaweld.com/mg-2-uo (MG2); lincolnelectric.com L-S6 (typical results, AWS A5.18).'
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
    b_wire,
    'Magmaweld MG2 (SG2 / ER70S-6)',
    'MG2-D12-15',
    'Bakır kaplı, düşük alaşımlı çelik GMAW teli. Tipik kaynak metali (C1): Rm 540 N/mm2, Re 430 N/mm2, A5 %29; (M21): Rm 560, Re 460, A5 %27. Onaylar: ABS, TUV, DB, DNV, RINA (üretici tablosu).',
    'Magmaweld',
    'MG2 Ø1,2 mm 15 kg',
    jsonb_build_object(
      'standards', jsonb_build_array('AWS A5.18 ER70S-6', 'EN ISO 14341-A G 42 3 C1 3Si1', 'DIN 1.5125'),
      'typical_composition_pct', jsonb_build_object('C', 0.07, 'Si', 0.9, 'Mn', 1.45),
      'weld_metal_typical', jsonb_build_object(
        'C1_gas', jsonb_build_object('Rm_N_mm2', 540, 'Re_N_mm2', 430, 'A5_pct', 29),
        'M21_gas', jsonb_build_object('Rm_N_mm2', 560, 'Re_N_mm2', 460, 'A5_pct', 27)
      ),
      'diameter_mm', 1.2,
      'spool_kg', 15,
      'welding_current_1_2mm_A', '120-280',
      'source_ref', 'magmaweld.com MG2 ürün / teknik sayfa'
    ),
    1280.00,
    'TRY',
    1,
    5,
    88, 90, 92,
    5, 0,
    95, 82, 80,
    86, 78, 94,
    88, 85, 87,
    4200, 12,
    'Düşük',
    1, true, false,
    'Yerel stok ve fiyat avantajı varsayımı; laboratuvar değerleri üretici tipik tablosundan.'
  ),
  (
    b_wire,
    'Lincoln Electric L-S6 (ER70S-6)',
    'LS6-D12-15',
    'AWS A5.18 ER70S-6. Tipik sonuç (CO2, DC+): Akma 474 MPa, çekme 585 MPa, uzama %30, Charpy 37 J @ -30C. Tipik analiz: C 0.07 %, Mn 1.48 %, Si 0.87 % (Lincoln tipik değerleri).',
    'Lincoln Electric',
    'L-S6 Ø1,2 mm 15 kg',
    jsonb_build_object(
      'standards', jsonb_build_array('AWS A5.18 ER70S-6'),
      'typical_composition_pct', jsonb_build_object('C', 0.07, 'Mn', 1.48, 'Si', 0.87),
      'typical_as_welded_CO2', jsonb_build_object(
        'yield_MPa', 474, 'tensile_MPa', 585, 'elongation_pct', 30,
        'charpy_J_minus30C', 37
      ),
      'aws_minimum_requirement', jsonb_build_object(
        'yield_MPa', 400, 'tensile_MPa', 480, 'elongation_min_pct', 22
      ),
      'diameter_mm', 1.2,
      'spool_kg', 15,
      'source_ref', 'lincolnelectric.com L-S6 (typical results, conformance table)'
    ),
    1420.00,
    'TRY',
    1,
    7,
    91, 92, 89,
    7, 0,
    94, 80, 78,
    92, 80, 95,
    92, 88, 90,
    4800, 10,
    'Düşük',
    2, false, true,
    'Tipik çekme mukavemeti ve darbe enerjisi üretici tipik tablosunda yüksek; birim fiyat referans piyasa.'
  );
END;
$$;
