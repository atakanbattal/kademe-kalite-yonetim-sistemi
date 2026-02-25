import type { Context, Config } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const SUPER_ADMIN_EMAIL = "atakan.battal@kademe.com.tr";

export default async (req: Request, context: Context) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Netlify.env.get("VITE_SUPABASE_URL") || "";
    const supabaseAnonKey = Netlify.env.get("VITE_SUPABASE_ANON_KEY") || "";
    const supabaseServiceKey = Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Sunucu yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Yetkisiz: Authorization header eksik" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await supabaseClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Yetkisiz: Geçerli oturum bulunamadı" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("permissions")
      .eq("id", caller.id)
      .single();

    const hasSettingsFull =
      callerProfile?.permissions?.settings === "full" ||
      caller.user_metadata?.permissions?.settings === "full";

    if (!isSuperAdmin && !hasSettingsFull) {
      return new Response(
        JSON.stringify({ error: "Yetkisiz: Bu işlem için yetkiniz yok" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, userId, payload } = body;

    if (action === "update_permissions") {
      if (!userId || !payload?.permissions) {
        return new Response(
          JSON.stringify({ error: "userId ve permissions gerekli" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { permissions, user_metadata } = payload;

      const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { ...user_metadata, permissions },
      });

      if (metaErr) {
        return new Response(
          JSON.stringify({ error: `user_metadata güncellenemedi: ${metaErr.message}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ permissions })
        .eq("id", userId);

      if (profileErr) {
        return new Response(
          JSON.stringify({ error: `profiles güncellenemedi: ${profileErr.message}` }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (action === "update_password") {
      const { newPassword } = payload || {};
      if (!userId || !newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "userId ve en az 6 karakterli newPassword gerekli" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_user") {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId gerekli" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (payload?.email === SUPER_ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: "Ana admin hesabı silinemez" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }

      const { error: cleanupErr } = await supabaseAdmin.rpc("cleanup_user_references", {
        target_user_id: userId,
      });
      if (cleanupErr) {
        console.log("cleanup_user_references:", cleanupErr.message);
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        return new Response(
          JSON.stringify({ error: `Kullanıcı silinemedi: ${error.message}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Bilinmeyen action: ${action}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Beklenmeyen hata";
    console.error("manage-user error:", err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = {};
