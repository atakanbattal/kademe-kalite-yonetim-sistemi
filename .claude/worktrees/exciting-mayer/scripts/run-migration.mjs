import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxNDgxMiwiZXhwIjoyMDcyMzkwODEyfQ.8P7lfCLFgqpEv3V_HgGT-_qJWy7Eg-vNpxCTkSCqCZY';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('Running migration...');
    
    // SQL komutlarını tek tek çalıştır
    const sqlCommands = [
        // suppliers tablosuna kolonlar ekle
        `ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS supplier_grade TEXT CHECK (supplier_grade IN ('A', 'B', 'C', 'D'))`,
        `ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS grade_reason TEXT`,
        `ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS grade_updated_at TIMESTAMPTZ`,
    ];

    for (const sql of sqlCommands) {
        try {
            const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
            if (error) {
                // Bazı hatalar beklenen hatalar olabilir (örn: kolon zaten var)
                console.warn('Warning:', error.message);
            } else {
                console.log('Success:', sql.substring(0, 50) + '...');
            }
        } catch (e) {
            console.error('Error:', e.message);
        }
    }
    
    console.log('Migration completed!');
}

runMigration();
