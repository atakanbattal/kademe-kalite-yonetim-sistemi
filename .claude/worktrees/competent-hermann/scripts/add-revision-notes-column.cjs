const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addRevisionNotesColumn() {
    console.log('Adding revision_notes column to process_control_plans...');
    
    // Test if column already exists by trying to select it
    const { data: testData, error: testError } = await supabase
        .from('process_control_plans')
        .select('revision_notes')
        .limit(1);
    
    if (!testError) {
        console.log('✅ revision_notes column already exists!');
        return;
    }
    
    console.log('Column does not exist, creating via SQL...');
    
    // Use raw SQL through a function or direct connection
    // Since we can't run ALTER TABLE directly, we'll update the schema through Supabase dashboard
    console.log('');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE process_control_plans ADD COLUMN IF NOT EXISTS revision_notes TEXT;');
    console.log('');
}

addRevisionNotesColumn().catch(console.error);
