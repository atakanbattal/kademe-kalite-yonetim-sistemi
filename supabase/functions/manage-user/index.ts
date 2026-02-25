import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPER_ADMIN_EMAIL = 'atakan.battal@kademe.com.tr';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Yetkisiz: Authorization header eksik' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY tanımlı değil');
      return new Response(
        JSON.stringify({ error: 'Sunucu yapılandırma hatası' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Yetkisiz: Geçerli oturum bulunamadı' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const body = await req.json();
    const { action, userId, payload } = body;

    if (action === 'delete_user') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId gerekli' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;
      const hasSettingsFull = (caller.user_metadata?.permissions?.['settings'] === 'full') ||
        (caller.app_metadata?.permissions?.['settings'] === 'full');

      if (!isSuperAdmin && !hasSettingsFull) {
        return new Response(
          JSON.stringify({ error: 'Yetkisiz: Kullanıcı silme yetkiniz yok' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      if (payload?.email === SUPER_ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: 'Ana admin hesabı silinemez' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Tüm FK referanslarını dinamik olarak temizle (62 tablo/kolon)
      const { error: cleanupErr } = await supabaseAdmin.rpc('cleanup_user_references', { target_user_id: userId });
      if (cleanupErr) console.log('cleanup_user_references:', cleanupErr.message);

      const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error('deleteUser error:', error);
        return new Response(
          JSON.stringify({ error: `Kullanıcı silinemedi: ${error.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'update_password') {
      const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;
      const hasSettingsFull = (caller.user_metadata?.permissions?.['settings'] === 'full') ||
        (caller.app_metadata?.permissions?.['settings'] === 'full');

      if (!isSuperAdmin && !hasSettingsFull) {
        return new Response(
          JSON.stringify({ error: 'Yetkisiz: Şifre değiştirme yetkiniz yok' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const { newPassword } = payload || {};
      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Şifre en az 6 karakter olmalıdır' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (action === 'update_permissions') {
      const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;
      const hasSettingsFull = (caller.user_metadata?.permissions?.['settings'] === 'full') ||
        (caller.app_metadata?.permissions?.['settings'] === 'full');

      if (!isSuperAdmin && !hasSettingsFull) {
        return new Response(
          JSON.stringify({ error: 'Yetkisiz: İzin güncelleme yetkiniz yok' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }

      const { permissions, user_metadata } = payload || {};
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { ...user_metadata, permissions },
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Bilinmeyen action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  } catch (err) {
    console.error('manage-user error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Beklenmeyen hata' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
