import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
});

// CamelCase dönüştürme fonksiyonu
function toCamelCase(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .trim();
}

async function updateCustomerNames() {
    console.log('🚀 Müşteri isimlerini CamelCase formatına çevirme işlemi başlıyor...\n');

    // Tüm araçları çek
    let allVehicles = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('produced_vehicles')
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('❌ Veri çekme hatası:', error.message);
            return;
        }

        if (!data || data.length === 0) break;
        allVehicles = [...allVehicles, ...data];
        page++;

        if (data.length < pageSize) break;
    }

    console.log(`📊 Toplam ${allVehicles.length} araç kaydı bulundu.\n`);

    // Güncellenmesi gereken kayıtları filtrele
    const toUpdate = allVehicles.filter(v => {
        if (!v.customer_name) return false;
        const camelCase = toCamelCase(v.customer_name);
        return v.customer_name !== camelCase;
    });

    console.log(`🔄 ${toUpdate.length} kayıt güncellenmesi gerekiyor.\n`);

    if (toUpdate.length === 0) {
        console.log('✅ Tüm müşteri isimleri zaten CamelCase formatında!');
        return;
    }

    // Güncellemeleri yap
    let successCount = 0;
    let errorCount = 0;

    for (const vehicle of toUpdate) {
        const newName = toCamelCase(vehicle.customer_name);
        
        const { error } = await supabase
            .from('produced_vehicles')
            .update({ customer_name: newName })
            .eq('id', vehicle.id);

        if (error) {
            console.error(`❌ Hata (ID: ${vehicle.id}): ${error.message}`);
            errorCount++;
        } else {
            console.log(`✓ "${vehicle.customer_name}" → "${newName}"`);
            successCount++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Başarılı: ${successCount}`);
    console.log(`❌ Hatalı: ${errorCount}`);
    console.log('='.repeat(50));
}

updateCustomerNames().catch(console.error);
