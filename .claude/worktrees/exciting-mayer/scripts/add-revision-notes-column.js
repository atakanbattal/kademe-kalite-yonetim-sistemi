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
    
    const { error } = await supabase.rpc('exec_sql', {
        sql: `
            ALTER TABLE process_control_plans 
            ADD COLUMN IF NOT EXISTS revision_notes TEXT;
            
            COMMENT ON COLUMN process_control_plans.revision_notes IS 'Kontrol planı revizyonu ile ilgili notlar';
        `
    });
    
    if (error) {
        console.error('Error adding column:', error.message);
        // Try direct approach
        console.log('Trying alternative method...');
        
        // First check if column exists
        const { data: columns, error: checkError } = await supabase
            .from('process_control_plans')
            .select('*')
            .limit(1);
        
        if (checkError) {
            console.error('Check error:', checkError.message);
        } else {
            console.log('Current columns:', Object.keys(columns[0] || {}));
        }
    } else {
        console.log('✅ revision_notes column added successfully!');
    }
}

addRevisionNotesColumn().catch(console.error);
