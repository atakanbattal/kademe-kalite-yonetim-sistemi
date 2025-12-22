/**
 * Mevcut Girdi Kontrol Kayıtları İçin Otomatik Stok Risk Kontrolü Oluşturma Scripti
 * 
 * Bu script, Ret veya Şartlı Kabul durumunda olan ve daha önce stok risk kontrolü oluşturulmamış
 * tüm incoming_inspections kayıtları için otomatik olarak stok risk kontrolü kayıtları oluşturur.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// .env.local dosyasını oku
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');

let supabaseUrl, supabaseKey;

try {
    const envFile = readFileSync(envPath, 'utf-8');
    const envVars = {};
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
    });
    supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
} catch (error) {
    // .env.local yoksa process.env'den oku
    supabaseUrl = process.env.VITE_SUPABASE_URL;
    supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL veya Key bulunamadı!');
    console.error('Lütfen .env.local dosyasında VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değerlerini kontrol edin.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createStockRiskControlsForExistingRecords() {
    console.log('🚀 Mevcut kayıtlar için stok risk kontrolü oluşturma işlemi başlatılıyor...\n');

    try {
        // 1. Önce toplam kayıt sayısını kontrol et
        const { count: totalCount } = await supabase
            .from('incoming_inspections')
            .select('*', { count: 'exact', head: true });
        
        console.log(`📊 Toplam incoming_inspections kayıt sayısı: ${totalCount || 0}\n`);
        
        // 2. Ret veya Şartlı Kabul durumunda olan VEYA ret/şartlı kabul miktarı > 0 olan tüm kayıtları bul
        console.log('📋 Ret veya Şartlı Kabul durumundaki kayıtlar aranıyor...');
        
        // Önce decision değerine göre kontrol et
        const { data: byDecision, error: decisionError } = await supabase
            .from('incoming_inspections')
            .select('id, record_no, part_code, part_name, inspection_date, decision, quantity_rejected, quantity_conditional, supplier_id')
            .in('decision', ['Ret', 'Şartlı Kabul'])
            .order('inspection_date', { ascending: false });
        
        // Sonra quantity_rejected veya quantity_conditional > 0 olan kayıtları bul
        const { data: byQuantity, error: quantityError } = await supabase
            .from('incoming_inspections')
            .select('id, record_no, part_code, part_name, inspection_date, decision, quantity_rejected, quantity_conditional, supplier_id')
            .or('quantity_rejected.gt.0,quantity_conditional.gt.0')
            .order('inspection_date', { ascending: false });
        
        // İki sonucu birleştir ve tekrarları kaldır
        const allInspections = [];
        const seenIds = new Set();
        
        if (byDecision) {
            byDecision.forEach(item => {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    allInspections.push(item);
                }
            });
        }
        
        if (byQuantity) {
            byQuantity.forEach(item => {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    allInspections.push(item);
                }
            });
        }
        
        const rejectedOrConditionalInspections = allInspections;
        const fetchError = decisionError || quantityError;

        if (fetchError) {
            throw new Error(`Kayıtlar çekilirken hata: ${fetchError.message}`);
        }

        if (!rejectedOrConditionalInspections || rejectedOrConditionalInspections.length === 0) {
            console.log('✅ Ret veya Şartlı Kabul durumunda kayıt bulunamadı.');
            return;
        }

        console.log(`✅ ${rejectedOrConditionalInspections.length} adet Ret/Şartlı Kabul kaydı bulundu.\n`);

        let processedCount = 0;
        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // 2. Her kayıt için kontrol et ve gerekirse stok risk kontrolü oluştur
        for (const inspection of rejectedOrConditionalInspections) {
            try {
                // Ret veya şartlı kabul miktarı var mı kontrol et
                const hasRejectedOrConditional = 
                    (inspection.quantity_rejected && parseInt(inspection.quantity_rejected, 10) > 0) ||
                    (inspection.quantity_conditional && parseInt(inspection.quantity_conditional, 10) > 0);

                if (!hasRejectedOrConditional || !inspection.part_code) {
                    skippedCount++;
                    continue;
                }

                // Daha önce bu kayıt için stok risk kontrolü oluşturulmuş mu kontrol et
                const { data: existingControls, error: checkError } = await supabase
                    .from('stock_risk_controls')
                    .select('id')
                    .eq('source_inspection_id', inspection.id)
                    .limit(1);

                if (checkError) {
                    console.error(`⚠️  Kayıt ${inspection.record_no} için kontrol hatası: ${checkError.message}`);
                    errorCount++;
                    continue;
                }

                if (existingControls && existingControls.length > 0) {
                    skippedCount++;
                    continue;
                }

                // Riskli stokları kontrol et
                const inspectionDate = inspection.inspection_date 
                    ? new Date(inspection.inspection_date).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0];

                const { data: riskyStockInspections, error: riskyStockError } = await supabase
                    .from('incoming_inspections')
                    .select('id, supplier_id')
                    .eq('part_code', inspection.part_code)
                    .in('decision', ['Kabul', 'Kabul Edildi'])
                    .gt('quantity_accepted', 0)
                    .lte('inspection_date', inspectionDate)
                    .neq('id', inspection.id)
                    .order('inspection_date', { ascending: false })
                    .limit(10);

                if (riskyStockError) {
                    console.error(`⚠️  Kayıt ${inspection.record_no} için riskli stok kontrolü hatası: ${riskyStockError.message}`);
                    errorCount++;
                    continue;
                }

                if (!riskyStockInspections || riskyStockInspections.length === 0) {
                    skippedCount++;
                    continue;
                }

                // Stok risk kontrolü kayıtları oluştur
                const recordsToInsert = riskyStockInspections.map(item => ({
                    source_inspection_id: inspection.id,
                    controlled_inspection_id: item.id,
                    part_code: inspection.part_code,
                    part_name: inspection.part_name,
                    supplier_id: item.supplier_id || null,
                    results: [{
                        measurement_type: 'Görsel Kontrol',
                        result: null,
                        value: '',
                        notes: ''
                    }],
                    decision: 'Beklemede',
                    controlled_by_id: null, // Sistem tarafından oluşturulduğu için null
                    status: 'Beklemede'
                }));

                const { error: insertError } = await supabase
                    .from('stock_risk_controls')
                    .insert(recordsToInsert);

                if (insertError) {
                    console.error(`❌ Kayıt ${inspection.record_no} için stok risk kontrolü oluşturulamadı: ${insertError.message}`);
                    errorCount++;
                } else {
                    createdCount++;
                    console.log(`✅ Kayıt ${inspection.record_no} (${inspection.part_code}) için ${recordsToInsert.length} adet stok risk kontrolü kaydı oluşturuldu.`);
                }

                processedCount++;

            } catch (error) {
                console.error(`❌ Kayıt ${inspection.record_no} işlenirken hata: ${error.message}`);
                errorCount++;
            }
        }

        console.log('\n📊 İşlem Özeti:');
        console.log(`   - Toplam işlenen kayıt: ${processedCount}`);
        console.log(`   - Oluşturulan stok risk kontrolü: ${createdCount}`);
        console.log(`   - Atlanan kayıt (zaten var veya riskli stok yok): ${skippedCount}`);
        console.log(`   - Hata: ${errorCount}`);
        console.log('\n✅ İşlem tamamlandı!');

    } catch (error) {
        console.error('❌ Genel hata:', error.message);
        process.exit(1);
    }
}

// Scripti çalıştır
createStockRiskControlsForExistingRecords()
    .then(() => {
        console.log('\n🎉 Script başarıyla tamamlandı!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Script hatası:', error);
        process.exit(1);
    });

