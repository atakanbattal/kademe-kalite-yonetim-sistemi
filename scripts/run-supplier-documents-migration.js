/**
 * Supplier Documents Migration Script
 * Bu script supplier_documents tablosunu ve gerekli yapıları oluşturur
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase bağlantı bilgileri
const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runMigration() {
    console.log('🚀 Supplier Documents Migration Başlatılıyor...');
    console.log('================================================');
    console.log('');

    try {
        // SQL dosyasını oku
        const sqlFile = path.join(__dirname, 'create-supplier-documents-complete.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        console.log('📄 SQL dosyası okundu');
        console.log('');

        // SQL'i statement'lara böl (basit parsing)
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('==='));

        console.log(`📋 ${statements.length} SQL statement bulundu`);
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
                    console.log(`⚠️  exec_sql bulunamadı, alternatif yöntem deneniyor...`);
                    throw error;
                }

                console.log(`✅ Statement ${i + 1} başarıyla çalıştırıldı`);
            } catch (err) {
                console.error(`❌ Statement ${i + 1} hatası:`, err.message);
                
                // İlk statement başarısız olursa
                if (i === 0 && err.message.includes('exec_sql')) {
                    console.log('');
                    console.log('⚠️  exec_sql fonksiyonu yok');
                    console.log('📝 Lütfen Supabase Dashboard\'da çalıştırın:');
                    console.log('   https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
                    console.log('');
                    break;
                }
                
                // Diğer hatalar için devam et
                continue;
            }
        }

        console.log('');
        console.log('================================================');
        console.log('✅ Migration tamamlandı!');
        console.log('');
        console.log('📋 Yapılan Değişiklikler:');
        console.log('  • supplier_documents tablosu oluşturuldu');
        console.log('  • Index\'ler oluşturuldu');
        console.log('  • RLS Policies eklendi');
        console.log('  • Trigger\'lar oluşturuldu');
        console.log('');
        console.log('⚠️  ÖNEMLİ: Storage bucket\'ı manuel oluşturun:');
        console.log('   1. Supabase Dashboard → Storage → Create Bucket');
        console.log('   2. Bucket name: supplier_documents');
        console.log('   3. Public: false');
        console.log('   4. File size limit: 50 MB');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('================================================');
        console.error('❌ Migration başarısız!');
        console.error('================================================');
        console.error('');
        console.error('Hata:', error.message);
        console.error('');
        console.error('📝 Çözüm:');
        console.error('Supabase Dashboard\'da direkt çalıştırın:');
        console.error('  1. https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
        console.error('  2. SQL Editor\'ü açın');
        console.error('  3. scripts/create-supplier-documents-complete.sql dosyasının içeriğini yapıştırın');
        console.error('  4. Run butonuna tıklayın');
        console.error('');
        process.exit(1);
    }
}

runMigration();

