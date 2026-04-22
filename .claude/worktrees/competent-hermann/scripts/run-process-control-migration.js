/**
 * Proses Kontrol Modülü Migration Script
 * Bu script SQL'i Supabase'de direkt çalıştırır
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

// Supabase client oluştur (service role key ile)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function executeSQLStatement(sql) {
    try {
        // exec_sql RPC fonksiyonunu kullan
        const { data, error } = await supabase.rpc('exec_sql', {
            query: sql
        });

        if (error) {
            // exec_sql yoksa, direkt HTTP isteği dene
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ query: sql })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.text();
        }

        return data;
    } catch (err) {
        throw err;
    }
}

async function runMigration() {
    console.log('🚀 Proses Kontrol Modülü Migration Başlatılıyor...');
    console.log('');

    try {
        // Önce exec_sql fonksiyonunu oluştur (yoksa)
        console.log('📋 exec_sql fonksiyonu kontrol ediliyor...');
        const execSqlFunction = `
CREATE OR REPLACE FUNCTION exec_sql(query TEXT)
RETURNS TEXT AS $$
BEGIN
    EXECUTE query;
    RETURN 'Success';
EXCEPTION WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
        `;

        try {
            await executeSQLStatement(execSqlFunction);
            console.log('✅ exec_sql fonksiyonu hazır');
        } catch (err) {
            console.log('⚠️  exec_sql fonksiyonu oluşturulamadı, devam ediliyor...');
        }

        console.log('');
        console.log('📄 SQL dosyası okunuyor...');

        // SQL dosyasını oku
        const sqlFile = path.join(__dirname, 'create-process-control-module.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        console.log('✅ SQL dosyası okundu');
        console.log('');

        // SQL statement'larını ayır (noktalı virgül ile)
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => {
                // Boş satırları ve sadece yorum içeren satırları filtrele
                const cleaned = s.replace(/--.*$/gm, '').trim();
                return cleaned.length > 10 && !cleaned.match(/^COMMENT\s+ON/i);
            });

        console.log(`📋 ${statements.length} SQL statement bulundu`);
        console.log('');

        let successCount = 0;
        let errorCount = 0;

        // Her statement'ı çalıştır
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            
            if (!statement || statement.length < 10) {
                continue;
            }

            try {
                console.log(`⏳ Statement ${i + 1}/${statements.length} çalıştırılıyor...`);
                
                const result = await executeSQLStatement(statement + ';');

                if (result && result.includes('Error:')) {
                    // Zaten mevcut tablolar için hata mesajlarını görmezden gel
                    if (result.includes('already exists') || result.includes('duplicate')) {
                        console.log(`   ⚠️  Zaten mevcut, atlanıyor...`);
                        successCount++;
                    } else {
                        throw new Error(result);
                    }
                } else {
                    console.log(`✅ Statement ${i + 1} başarıyla çalıştırıldı`);
                    successCount++;
                }
            } catch (err) {
                errorCount++;
                const errorMsg = err.message || err.toString();
                
                // Zaten mevcut hatalarını görmezden gel
                if (errorMsg.includes('already exists') || 
                    errorMsg.includes('duplicate') || 
                    errorMsg.includes('IF NOT EXISTS')) {
                    console.log(`   ⚠️  Zaten mevcut, atlanıyor...`);
                    successCount++;
                    errorCount--;
                } else {
                    console.error(`❌ Statement ${i + 1} hatası:`, errorMsg);
                }
            }
        }

        console.log('');
        console.log('================================================');
        console.log(`✅ Migration tamamlandı!`);
        console.log(`   Başarılı: ${successCount}`);
        console.log(`   Hatalı: ${errorCount}`);
        console.log('');
        console.log('🎉 Proses Kontrol Modülü hazır!');
        console.log('');
        console.log('📝 Şimdi Storage bucket\'ını oluşturun:');
        console.log('   1. Supabase Dashboard → Storage');
        console.log('   2. "New bucket" → process_control');
        console.log('   3. Public: false');
        console.log('   4. Allowed MIME types: application/pdf, image/*, application/vnd.openxmlformats-officedocument.*');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Migration hatası:', error.message);
        console.error('');
        console.error('💡 Alternatif: SQL dosyasını Supabase Dashboard\'da manuel çalıştırın:');
        console.error('   1. https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
        console.error('   2. scripts/create-process-control-module.sql dosyasını açın');
        console.error('   3. İçeriği kopyalayıp SQL Editor\'e yapıştırın');
        console.error('   4. Run butonuna tıklayın');
        console.error('');
        process.exit(1);
    }
}

runMigration();

