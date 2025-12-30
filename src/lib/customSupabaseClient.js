import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rqnvoatirfczpklaamhf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxbnZvYXRpcmZjenBrbGFhbWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTQ4MTIsImV4cCI6MjA3MjM5MDgxMn0.eyUXdL9A8JD32bx3NcHRa-rvyDByP4RJfqD69qRolhM';

// Debug: Environment variables'ı kontrol et
if (import.meta.env.DEV) {
  console.log('🔍 Supabase Configuration:');
  console.log('  URL:', supabaseUrl ? '✓ Set' : '❌ Missing');
  console.log('  Key:', supabaseAnonKey ? '✓ Set' : '❌ Missing');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase configuration is incomplete!');
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

// Performans optimizasyonları ile client oluştur
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'kademe-qms'
      // NOT: Content-Type header'ı burada TANIMLANMAMALI!
      // Supabase client dosya yüklemelerinde otomatik olarak doğru
      // Content-Type'ı (multipart/form-data) ayarlar. Manuel tanımlamak
      // dosya yüklemelerini bozar.
    }
  },
  db: {
    schema: 'public'
  },
  // Realtime performans ayarları
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});