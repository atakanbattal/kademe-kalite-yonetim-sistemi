#!/usr/bin/env node

/**
 * QDMS SQL Migration - Doğrudan PostgreSQL Bağlantısı
 */

import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase PostgreSQL connection string
// Not: Password environment variable'dan alınmalı
const DB_HOST = 'db.rqnvoatirfczpklaamhf.supabase.co';
const DB_PORT = 5432;
const DB_NAME = 'postgres';
const DB_USER = 'postgres';
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD;

if (!DB_PASSWORD) {
    console.error('❌ Database password bulunamadı!');
    console.error('');
    console.error('Lütfen password\'ü ayarlayın:');
    console.error('  export SUPABASE_DB_PASSWORD="your-password"');
    console.error('');
    console.error('Password\'ü Supabase Dashboard > Settings > Database > Connection string\'den alabilirsiniz');
    console.error('');
    console.error('Alternatif: SQL\'i Supabase Dashboard\'dan çalıştırın:');
    console.error('  https://app.supabase.com/project/rqnvoatirfczpklaamhf/sql');
    console.error('');
    process.exit(1);
}

const client = new Client({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    ssl: {
        rejectUnauthorized: false
    }
});

async function executeMigration() {
    console.log('🚀 QDMS Migration Başlatılıyor...');
    console.log('=====================================');
    console.log('');

    try {
        console.log('📡 Veritabanına bağlanılıyor...');
        await client.connect();
        console.log('✅ Bağlantı başarılı!');
        console.log('');

        const sqlFilePath = join(__dirname, 'create-professional-qdms-system.sql');
        console.log(`📄 SQL dosyası okunuyor: ${sqlFilePath}`);
        
        const sqlContent = readFileSync(sqlFilePath, 'utf-8');
        console.log(`✅ SQL dosyası okundu (${sqlContent.length} karakter)`);
        console.log('');

        console.log('🔄 SQL çalıştırılıyor...');
        console.log('');

        // SQL'i çalıştır
        await client.query(sqlContent);

        console.log('✅ Migration başarıyla tamamlandı!');
        console.log('');
        console.log('🎉 Profesyonel QDMS sistemi hazır!');
        console.log('');
        console.log('📋 Yapılan değişiklikler:');
        console.log('   ✅ Documents tablosuna yeni kolonlar eklendi');
        console.log('   ✅ Document revisions tablosuna yeni kolonlar eklendi');
        console.log('   ✅ Yeni tablolar oluşturuldu (approvals, logs, comments, notifications, supplier_documents)');
        console.log('   ✅ İndeksler oluşturuldu');
        console.log('   ✅ Fonksiyonlar oluşturuldu');
        console.log('   ✅ Trigger\'lar oluşturuldu');
        console.log('   ✅ RLS politikaları eklendi');
        console.log('   ✅ View\'lar oluşturuldu');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Migration hatası:', error.message);
        console.error('');
        
        if (error.message.includes('password')) {
            console.error('💡 Password hatası! Lütfen doğru password\'ü ayarlayın.');
        } else if (error.message.includes('already exists')) {
            console.error('💡 Bazı objeler zaten mevcut. Bu normal olabilir.');
        } else {
            console.error('💡 Hata detayları:', error);
        }
        
        console.error('');
        process.exit(1);
    } finally {
        await client.end();
    }
}

executeMigration().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

