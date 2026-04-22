
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env parser
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^['"]|['"]$/g, '');
            env[key] = value;
        }
    });
    return env;
}

const env = { ...loadEnv('.env'), ...loadEnv('.env.local') };
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Supabase environment variables missing.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testFetch() {
    console.log('Testing quality_costs fetch...');

    // 1. Simpler query first
    console.log('--- Test 1: Simple Select ---');
    const simple = await supabase.from('quality_costs').select('id, cost_type, amount').limit(1);
    if (simple.error) {
        console.error('❌ Simple Fetch Failed:', simple.error.message);
    } else {
        console.log(`✅ Simple Fetch Success. Count: ${simple.data.length}`);
    }

    // 2. Complex query from DataContext
    console.log('\n--- Test 2: Complex Select (DataContext) ---');
    const { data, error } = await supabase
        .from('quality_costs')
        .select(`
            *,
            responsible_personnel:personnel!responsible_personnel_id(full_name),
            non_conformities(nc_number, id),
            supplier:suppliers!supplier_id(name)
        `)
        .limit(5);

    if (error) {
        console.error('❌ Complex Fetch Failed!');
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
    } else {
        console.log('✅ Complex Fetch Success!');
        console.log(`Retrieved ${data.length} records.`);
        if (data.length > 0) {
            console.log('Sample Record:', JSON.stringify(data[0], null, 2));
        }
    }
}

testFetch();
