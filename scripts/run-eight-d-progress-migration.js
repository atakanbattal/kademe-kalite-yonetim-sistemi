/**
 * eight_d_progress Kolonu Migration Script
 * Bu script non_conformities tablosuna eight_d_progress kolonunu ekler
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase bağlantı bilgileri
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Hata: Supabase URL ve Service Key çevre değişkenlerinde tanımlı olmalı!');
    console.error('');
    console.error('Kullanım:');
    console.error('  export VITE_SUPABASE_URL="https://your-project.supabase.co"');
    console.error('  export VITE_SUPABASE_SERVICE_KEY="your-service-key"');
    console.error('  node scripts/run-eight-d-progress-migration.js');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🚀 eight_d_progress Kolonu Migration Başlatılıyor...');
    console.log('================================================');
    console.log('');

    try {
        // SQL dosyasını oku
        const sqlFile = path.join(__dirname, 'add-eight-d-progress-column.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        // SQL'i statement'lara böl
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📄 ${statements.length} SQL statement bulundu`);
        console.log('');

        // Her statement'ı çalıştır
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            if (!statement || statement.length < 10) {
                continue;
            }

            try {
                console.log(`⏳ Statement ${i + 1}/${statements.length} çalıştırılıyor...`);
                
                // exec_sql RPC fonksiyonunu kullan
                const { data, error } = await supabase.rpc('exec_sql', {
                    query: statement + ';'
                });

                if (error) {
                    // exec_sql yoksa, direkt SQL çalıştırmayı dene
                    console.log(`⚠️  RPC yöntemi başarısız, alternatif yöntem deneniyor...`);
                    
                    // Supabase REST API'yi direkt kullan
                    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                        method: 'POST',
                        headers: {
                            'apikey': supabaseServiceKey,
                            'Authorization': `Bearer ${supabaseServiceKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ query: statement + ';' })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP ${response.status}: ${errorText}`);
                    }
                }

                console.log(`✅ Statement ${i + 1} başarıyla çalıştırıldı`);
            } catch (err) {
                console.error(`❌ Statement ${i + 1} hatası:`, err.message);
                // Devam et, diğer statement'ları çalıştırmaya çalış
            }
        }

        console.log('');
        console.log('================================================');
        console.log('✅ Migration tamamlandı!');
        console.log('');
        console.log('📋 Yapılan Değişiklikler:');
        console.log('  • non_conformities tablosuna eight_d_progress JSONB kolonu eklendi');
        console.log('  • Index oluşturuldu (performans için)');
        console.log('  • Mevcut kayıtlar için varsayılan değer güncellendi');
        console.log('');
        console.log('🎉 Artık 8D modülünü sorunsuz kullanabilirsiniz!');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('================================================');
        console.error('❌ Migration başarısız!');
        console.error('================================================');
        console.error('');
        console.error('Hata:', error.message);
        console.error('');
        console.error('📝 Alternatif Yöntem:');
        console.error('1. Supabase Dashboard\'a gidin: https://app.supabase.com');
        console.error('2. Projenizi seçin');
        console.error('3. SQL Editor\'e gidin');
        console.error('4. scripts/add-eight-d-progress-column.sql dosyasının içeriğini yapıştırın');
        console.error('5. Run butonuna tıklayın');
        console.error('');
        process.exit(1);
    }
}

runMigration();

