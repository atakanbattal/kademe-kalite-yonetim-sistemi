#!/usr/bin/env node

/**
 * QDMS Migration - Doğrudan Supabase'e SQL Çalıştırma
 * Bu script SQL'i Supabase REST API üzerinden çalıştırır
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://rqnvoatirfczpklaamhf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM';

async function executeSQL() {
    console.log('🚀 QDMS Migration SQL Çalıştırılıyor...');
    console.log('=====================================');
    console.log('');

    try {
        const sqlFilePath = join(__dirname, 'create-professional-qdms-system.sql');
        console.log(`📄 SQL dosyası okunuyor: ${sqlFilePath}`);
        
        const sqlContent = readFileSync(sqlFilePath, 'utf-8');
        console.log(`✅ SQL dosyası okundu (${sqlContent.length} karakter)`);
        console.log('');

        // SQL'i statement'lara böl
        // PostgreSQL'de çoklu statement çalıştırmak için özel bir yöntem gerekiyor
        // Supabase REST API doğrudan SQL çalıştırmayı desteklemiyor
        // Bu yüzden SQL'i hazır bir dosya olarak kaydedip kullanıcıya talimat verelim
        
        console.log('📋 SQL hazır!');
        console.log('');
        console.log('⚠️  Supabase REST API doğrudan SQL çalıştırmayı desteklemiyor.');
        console.log('   SQL\'i Supabase Dashboard\'dan çalıştırmanız gerekiyor.');
        console.log('');
        console.log('🌐 HIZLI ÇÖZÜM:');
        console.log('   1. Bu linke tıklayın:');
        console.log(`      https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql`);
        console.log('');
        console.log('   2. "New query" butonuna tıklayın');
        console.log('');
        console.log('   3. Aşağıdaki SQL\'i kopyalayıp yapıştırın:');
        console.log('');
        console.log('─'.repeat(70));
        console.log(sqlContent.substring(0, 200));
        console.log('...');
        console.log('─'.repeat(70));
        console.log('');
        console.log('   4. "Run" butonuna tıklayın (Ctrl+Enter veya Run butonu)');
        console.log('');
        console.log('✅ Migration tamamlandıktan sonra sayfayı yenileyin!');
        console.log('');

        // SQL'i kolay kopyalama için bir dosyaya yaz
        const outputFile = join(__dirname, 'qdms-migration-ready.sql');
        const fs = await import('fs');
        fs.writeFileSync(outputFile, sqlContent, 'utf-8');
        console.log(`💾 SQL içeriği hazır dosyaya yazıldı: ${outputFile}`);
        console.log('   Bu dosyayı açıp içeriğini Supabase SQL Editor\'e kopyalayabilirsiniz.');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Hata:', error.message);
        console.error('');
        process.exit(1);
    }
}

executeSQL();

