/**
 * Ürün Yönetimi Modülü Migration Script
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function executeSQLStatement(sql) {
    try {
        const { data, error } = await supabase.rpc('exec_sql', { query: sql });
        if (error) {
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
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            return await response.text();
        }
        return data;
    } catch (err) {
        throw err;
    }
}

async function runMigration() {
    console.log('🚀 Ürün Yönetimi Modülü Migration Başlatılıyor...\n');

    try {
        const sqlFile = path.join(__dirname, 'create-product-management-module.sql');
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        console.log('✅ SQL dosyası okundu\n');

        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => {
                const cleaned = s.replace(/--.*$/gm, '').trim();
                return cleaned.length > 10 && !cleaned.match(/^COMMENT\s+ON/i);
            });

        console.log(`📋 ${statements.length} SQL statement bulundu\n`);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (!statement || statement.length < 10) continue;

            try {
                console.log(`⏳ Statement ${i + 1}/${statements.length} çalıştırılıyor...`);
                const result = await executeSQLStatement(statement + ';');

                if (result && result.includes('Error:')) {
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
                if (errorMsg.includes('already exists') || errorMsg.includes('duplicate') || errorMsg.includes('IF NOT EXISTS')) {
                    console.log(`   ⚠️  Zaten mevcut, atlanıyor...`);
                    successCount++;
                    errorCount--;
                } else {
                    console.error(`❌ Statement ${i + 1} hatası:`, errorMsg);
                }
            }
        }

        console.log('\n================================================');
        console.log(`✅ Migration tamamlandı!`);
        console.log(`   Başarılı: ${successCount}`);
        console.log(`   Hatalı: ${errorCount}`);
        console.log('\n🎉 Ürün Yönetimi Modülü hazır!');
        console.log('');

    } catch (error) {
        console.error('\n❌ Migration hatası:', error.message);
        console.error('\n💡 Alternatif: SQL dosyasını Supabase Dashboard\'da manuel çalıştırın:');
        console.error('   1. https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
        console.error('   2. scripts/create-product-management-module.sql dosyasını açın');
        console.error('   3. İçeriği kopyalayıp SQL Editor\'e yapıştırın');
        console.error('   4. Run butonuna tıklayın');
        process.exit(1);
    }
}

runMigration();

