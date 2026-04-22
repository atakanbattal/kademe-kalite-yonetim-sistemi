/**
 * Final Araç Tipi Standartlaştırma Scripti
 * Belirtilen kurallara göre tüm araç tiplerini standartlaştırır
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Standartlaştırma kuralları - kullanıcının belirttiği kurallar
const STANDARDIZATION_RULES = {
    // AGA serisi
    'Aga6000': 'AGA6000',
    'aga6000': 'AGA6000',
    'AGA6000': 'AGA6000',
    'Aga2100': 'AGA2100',
    'aga2100': 'AGA2100',
    'AGA2100': 'AGA2100',
    'Aga3000': 'AGA3000',
    'aga3000': 'AGA3000',
    'AGA3000': 'AGA3000',
    
    // KDM serisi
    'Kdm35': 'KDM 35',
    'kdm35': 'KDM 35',
    'Kdm 35': 'KDM 35',
    'kdm 35': 'KDM 35',
    'KDM 35': 'KDM 35',
    'Kdm70': 'KDM 70',
    'kdm70': 'KDM 70',
    'Kdm 70': 'KDM 70',
    'kdm 70': 'KDM 70',
    'KDM 70': 'KDM 70',
    'Kdm80': 'KDM 80',
    'kdm80': 'KDM 80',
    'Kdm 80': 'KDM 80',
    'kdm 80': 'KDM 80',
    'KDM 80': 'KDM 80',
    
    // HSCK
    'Hsck': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
    'HSCK': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
    'hsck': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
    'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)': 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)',
};

function standardizeVehicleType(type) {
    if (!type) return type;
    
    const trimmed = type.trim();
    
    // Tam eşleşme
    if (STANDARDIZATION_RULES[trimmed]) {
        return STANDARDIZATION_RULES[trimmed];
    }
    
    // Normalize edilmiş eşleşme
    const normalized = trimmed.toLowerCase();
    for (const [key, value] of Object.entries(STANDARDIZATION_RULES)) {
        if (key.toLowerCase() === normalized) {
            return value;
        }
    }
    
    // Kısmi eşleşme
    if (normalized.includes('aga6000') || normalized === 'aga6000') {
        return 'AGA6000';
    }
    if (normalized.includes('aga2100') || normalized === 'aga2100') {
        return 'AGA2100';
    }
    if (normalized.includes('aga3000') || normalized === 'aga3000') {
        return 'AGA3000';
    }
    if ((normalized.includes('kdm') && normalized.includes('35')) || normalized === 'kdm35') {
        return 'KDM 35';
    }
    if ((normalized.includes('kdm') && normalized.includes('70')) || normalized === 'kdm70') {
        return 'KDM 70';
    }
    if ((normalized.includes('kdm') && normalized.includes('80')) || normalized === 'kdm80') {
        return 'KDM 80';
    }
    if (normalized.includes('hsck') || (normalized.includes('hsc') && !normalized.includes('hidrolik'))) {
        return 'HSCK (Hidrolik Sıkıştırmalı Çöp Kamyonu)';
    }
    
    return trimmed; // Değişiklik yoksa trimmed versiyonunu döndür
}

async function finalStandardize() {
    console.log('🚀 Final Araç Tipi Standartlaştırma Başlatılıyor...\n');

    try {
        // 1. Araç tipleri kategorisini al
        const { data: vehicleCategory } = await supabase
            .from('product_categories')
            .select('id')
            .eq('category_code', 'VEHICLE_TYPES')
            .single();

        if (!vehicleCategory) {
            throw new Error('VEHICLE_TYPES kategorisi bulunamadı!');
        }

        // 2. Tüm araç tipi ürünlerini al
        const { data: vehicleProducts, error: productsError } = await supabase
            .from('products')
            .select('id, product_code, product_name')
            .eq('category_id', vehicleCategory.id);

        if (productsError) throw productsError;

        console.log(`📋 ${vehicleProducts.length} araç tipi bulundu\n`);
        console.log('Mevcut araç tipleri:');
        vehicleProducts.forEach(p => {
            console.log(`   - ${p.product_code || p.product_name}`);
        });
        console.log('');

        // 3. Standartlaştırma yapılacak ürünleri bul ve grupla
        const updateMap = new Map(); // standard -> [products]
        
        for (const product of vehicleProducts) {
            const currentName = (product.product_name || product.product_code).trim();
            const standardized = standardizeVehicleType(currentName);
            
            if (currentName !== standardized) {
                if (!updateMap.has(standardized)) {
                    updateMap.set(standardized, []);
                }
                updateMap.get(standardized).push({
                    id: product.id,
                    current: currentName
                });
            }
        }

        // 4. Aynı standard'a giden ürünleri birleştir
        let updated = 0;
        let deleted = 0;

        for (const [standard, products] of updateMap.entries()) {
            if (products.length === 1) {
                // Tek ürün, güncelle
                const product = products[0];
                const { error } = await supabase
                    .from('products')
                    .update({
                        product_code: standard,
                        product_name: standard
                    })
                    .eq('id', product.id);

                if (error) {
                    console.error(`   ❌ ${product.current} -> ${standard} güncellenemedi: ${error.message}`);
                } else {
                    console.log(`   ✅ ${product.current} -> ${standard}`);
                    updated++;
                }
            } else {
                // Birden fazla ürün var, birleştir
                const mainProduct = products[0];
                const others = products.slice(1);

                // Ana ürünü güncelle
                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        product_code: standard,
                        product_name: standard
                    })
                    .eq('id', mainProduct.id);

                if (updateError) {
                    console.error(`   ❌ ${mainProduct.current} -> ${standard} güncellenemedi: ${updateError.message}`);
                } else {
                    console.log(`   ✅ ${mainProduct.current} -> ${standard} (ana kayıt)`);
                    updated++;
                }

                // Diğerlerini sil
                for (const other of others) {
                    const { error: deleteError } = await supabase
                        .from('products')
                        .delete()
                        .eq('id', other.id);

                    if (deleteError) {
                        console.error(`   ❌ ${other.current} silinemedi: ${deleteError.message}`);
                    } else {
                        console.log(`   🗑️  ${other.current} silindi (${standard} ile birleştirildi)`);
                        deleted++;
                    }
                }
            }
        }

        // 5. Veritabanı referanslarını güncelle
        console.log('\n🔄 Veritabanı referansları güncelleniyor...\n');

        const tablesToUpdate = [
            { table: 'quality_costs', column: 'vehicle_type' },
            { table: 'deviations', column: 'vehicle_type' },
            { table: 'quality_inspections', column: 'vehicle_type' },
            { table: 'kaizen_entries', column: 'vehicle_type' }
        ];

        let totalUpdated = 0;

        for (const { table, column } of tablesToUpdate) {
            try {
                // Tüm kayıtları al (limit olmadan)
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
                            console.log(`   ⏭️  ${table} tablosu bulunamadı, atlanıyor`);
                        }
                        break;
                    }

                    if (!records || records.length === 0) break;
                    
                    allRecords = allRecords.concat(records);
                    if (records.length < limit) break;
                    offset += limit;
                }

                if (allRecords.length === 0) {
                    continue;
                }

                let tableUpdated = 0;
                for (const record of allRecords) {
                    const oldValue = record[column];
                    if (!oldValue) continue;

                    const standardized = standardizeVehicleType(oldValue);
                    if (oldValue !== standardized) {
                        const { error: updateError } = await supabase
                            .from(table)
                            .update({ [column]: standardized })
                            .eq('id', record.id);

                        if (!updateError) {
                            tableUpdated++;
                        }
                    }
                }

                if (tableUpdated > 0) {
                    console.log(`   ✅ ${table}: ${tableUpdated} kayıt güncellendi`);
                    totalUpdated += tableUpdated;
                }
            } catch (err) {
                // Tablo yoksa sessizce geç
            }
        }

        // 6. Özet
        console.log('\n================================================');
        console.log('✅ Standartlaştırma tamamlandı!');
        console.log(`   📦 Products: ${updated} güncellendi, ${deleted} silindi`);
        console.log(`   🔄 Veritabanı referansları: ${totalUpdated} kayıt güncellendi`);
        console.log('\n🎉 Tüm araç tipleri standartlaştırıldı!');
        console.log('');

    } catch (error) {
        console.error('\n❌ Standartlaştırma hatası:', error.message);
        console.error(error);
        process.exit(1);
    }
}

finalStandardize();

