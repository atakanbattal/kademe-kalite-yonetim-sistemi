import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);