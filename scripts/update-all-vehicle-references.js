/**
 * Tüm Veritabanı Referanslarını Güncelleme Scripti
 * Tüm tablolardaki vehicle_type değerlerini standartlaştırır
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Standartlaştırma kuralları
const STANDARDIZATION_MAP = {
    'HSCK': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
    'Hsck': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
    'hsck': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
    'Aga6000': 'AGA6000',
    'aga6000': 'AGA6000',
    'Aga2100': 'AGA2100',
    'aga2100': 'AGA2100',
    'Aga3000': 'AGA3000',
    'aga3000': 'AGA3000',
    'Kdm35': 'KDM 35',
    'kdm35': 'KDM 35',
    'Kdm 35': 'KDM 35',
    'kdm 35': 'KDM 35',
    'Kdm70': 'KDM 70',
    'kdm70': 'KDM 70',
    'Kdm 70': 'KDM 70',
    'kdm 70': 'KDM 70',
    'Kdm80': 'KDM 80',
    'kdm80': 'KDM 80',
    'Kdm 80': 'KDM 80',
    'kdm 80': 'KDM 80',
};

function standardizeValue(value) {
    if (!value) return value;
    const trimmed = value.trim();
    return STANDARDIZATION_MAP[trimmed] || STANDARDIZATION_MAP[trimmed.toLowerCase()] || trimmed;
}

async function updateAllReferences() {
    console.log('🚀 Tüm Veritabanı Referansları Güncelleniyor...\n');

    const tablesToUpdate = [
        { table: 'quality_costs', column: 'vehicle_type' },
        { table: 'deviations', column: 'vehicle_type' },
        { table: 'quality_inspections', column: 'vehicle_type' },
        { table: 'kaizen_entries', column: 'vehicle_type' }
    ];

    let totalUpdated = 0;

    for (const { table, column } of tablesToUpdate) {
        try {
            console.log(`📊 ${table} tablosu işleniyor...`);
            
            // Tüm kayıtları al
            let allRecords = [];
            let offset = 0;
            const limit = 1000;

            while (true) {
                const { data: records, error: fetchError } = await supabase
                    .from(table)
                    .select(`id, ${column}`)
                    .not(column, 'is', null)
                    .range(offset, offset + limit - 1);

                if (fetchError) {
                    if (fetchError.code === '42P01') {
                        console.log(`   ⏭️  ${table} tablosu bulunamadı, atlanıyor\n`);
                    } else {
                        console.log(`   ⚠️  Hata: ${fetchError.message}\n`);
                    }
                    break;
                }

                if (!records || records.length === 0) break;
                allRecords = allRecords.concat(records);
                if (records.length < limit) break;
                offset += limit;
            }

            if (allRecords.length === 0) {
                console.log(`   ℹ️  Güncellenecek kayıt yok\n`);
                continue;
            }

            console.log(`   📋 ${allRecords.length} kayıt bulundu`);

            // Benzersiz değerleri bul
            const uniqueValues = new Set();
            allRecords.forEach(r => {
                if (r[column]) uniqueValues.add(r[column].trim());
            });

            console.log(`   🔍 Benzersiz değerler: ${Array.from(uniqueValues).join(', ')}`);

            // Güncelleme yapılacak kayıtları bul
            let tableUpdated = 0;
            for (const record of allRecords) {
                const oldValue = record[column];
                if (!oldValue) continue;

                const standardized = standardizeValue(oldValue);
                if (oldValue !== standardized) {
                    const { error: updateError } = await supabase
                        .from(table)
                        .update({ [column]: standardized })
                        .eq('id', record.id);

                    if (updateError) {
                        console.error(`   ❌ ID ${record.id} güncellenemedi: ${updateError.message}`);
                    } else {
                        tableUpdated++;
                    }
                }
            }

            if (tableUpdated > 0) {
                console.log(`   ✅ ${tableUpdated} kayıt güncellendi\n`);
                totalUpdated += tableUpdated;
            } else {
                console.log(`   ℹ️  Güncellenecek kayıt yok\n`);
            }
        } catch (err) {
            console.error(`   ❌ ${table} işlenirken hata: ${err.message}\n`);
        }
    }

    console.log('================================================');
    console.log(`✅ Toplam ${totalUpdated} kayıt güncellendi`);
    console.log('\n🎉 Tüm veritabanı referansları standartlaştırıldı!');
    console.log('');
}

updateAllReferences();

