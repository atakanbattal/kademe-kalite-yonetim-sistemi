/**
 * Produced Vehicle Cost Integration SQL Execution
 * Bu script SQL'i Supabase'e direkt gönderir
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase bağlantı bilgileri
const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
    console.log('🚀 Produced Vehicle Cost Integration Migration Başlatılıyor...');
    console.log('================================================');
    console.log('');

    try {
        // SQL dosyasını oku
        const sqlFile = path.join(__dirname, 'add-produced-vehicle-cost-integration.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');

        console.log('📄 SQL dosyası okundu');
        console.log('');

        // SQL statement'larını ayır
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📋 ${statements.length} SQL statement bulundu`);
        console.log('');

        // Her statement'ı tek tek çalıştır
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
                    throw error;
                }

                console.log(`✅ Statement ${i + 1} başarıyla çalıştırıldı`);
                console.log('');
            } catch (err) {
                console.error(`❌ Statement ${i + 1} hatası:`, err.message);
                console.log('');
                console.log('⚠️  exec_sql RPC fonksiyonu bulunamadı veya yetki hatası');
                console.log('📝 SQL\'i Supabase Dashboard\'da çalıştırın:');
                console.log('   https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
                console.log('');
                break;
            }
        }

        console.log('================================================');
        console.log('✅ Migration tamamlandı!');
        console.log('');

    } catch (error) {
        console.error('❌ Migration hatası:', error.message);
        console.error('');
        console.error('💡 SQL\'i manuel olarak çalıştırın:');
        console.error('   https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
        console.error('');
    }
}

runMigration();

