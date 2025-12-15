/**
 * Proses Kontrol Modülü Storage Bucket Oluşturma Script'i
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.2YJmKcpk1kHbAOc-H9s37NbUY74QJuqIYB1Z2ssusa4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createStorageBucket() {
    console.log('🚀 Storage Bucket Oluşturuluyor...');
    console.log('');

    try {
        // Bucket var mı kontrol et
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('❌ Bucket listesi alınamadı:', listError.message);
            return;
        }

        const bucketExists = buckets?.some(b => b.name === 'process_control');
        
        if (bucketExists) {
            console.log('✅ process_control bucket zaten mevcut');
            return;
        }

        // Bucket oluştur
        console.log('📦 process_control bucket oluşturuluyor...');
        
        const { data, error } = await supabase.storage.createBucket('process_control', {
            public: false,
            allowedMimeTypes: [
                'application/pdf',
                'image/png',
                'image/jpeg',
                'image/jpg',
                'image/gif',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ],
            fileSizeLimit: 52428800 // 50MB
        });

        if (error) {
            // Management API ile dene
            console.log('⚠️  Storage API ile oluşturulamadı, Management API deneniyor...');
            
            const response = await fetch(`${supabaseUrl}/storage/v1/bucket`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: 'process_control',
                    public: false,
                    allowed_mime_types: [
                        'application/pdf',
                        'image/*',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    ],
                    file_size_limit: 52428800
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            console.log('✅ process_control bucket Management API ile oluşturuldu');
        } else {
            console.log('✅ process_control bucket başarıyla oluşturuldu');
        }

        console.log('');
        console.log('🎉 Storage bucket hazır!');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Storage bucket oluşturma hatası:', error.message);
        console.error('');
        console.error('💡 Alternatif: Supabase Dashboard\'dan manuel oluşturun:');
        console.error('   1. https://app.supabase.com/project/rqnvoatirfczpklaamhf/storage/buckets');
        console.error('   2. "New bucket" butonuna tıklayın');
        console.error('   3. Name: process_control');
        console.error('   4. Public: false (kapalı)');
        console.error('   5. Allowed MIME types: application/pdf, image/*, application/vnd.openxmlformats-officedocument.*');
        console.error('   6. Create bucket');
        console.error('');
    }
}

createStorageBucket();

