import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

const SUPER_ADMIN_EMAIL = 'atakan.battal@kademe.com.tr';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const nodeSupabaseOptions = {
	auth: { autoRefreshToken: false, persistSession: false },
	realtime: { transport: ws },
};

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * Hesap yönetimi (izin, şifre, silme) — Netlify Function ve Vite dev middleware ortak handler.
 * Node.js 20'de Supabase Realtime için `ws` transport zorunlu.
 */
export async function handleManageUserRequest(req, env = {}) {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { status: 200 });
	}

	if (req.method !== 'POST') {
		return jsonResponse({ error: 'Method not allowed' }, 405);
	}

	try {
		const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
		const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
		const supabaseServiceKey =
			env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_KEY || '';

		if (!supabaseServiceKey) {
			return jsonResponse(
				{ error: 'Sunucu yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik' },
				500
			);
		}

		const authHeader = req.headers.get('Authorization');
		if (!authHeader) {
			return jsonResponse({ error: 'Yetkisiz: Authorization header eksik' }, 401);
		}

		const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
			...nodeSupabaseOptions,
			global: { headers: { Authorization: authHeader } },
		});

		const {
			data: { user: caller },
			error: authError,
		} = await supabaseClient.auth.getUser();

		if (authError || !caller) {
			return jsonResponse({ error: 'Yetkisiz: Geçerli oturum bulunamadı' }, 401);
		}

		const isSuperAdmin = caller.email === SUPER_ADMIN_EMAIL;

		const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, nodeSupabaseOptions);

		const { data: callerProfile } = await supabaseAdmin
			.from('profiles')
			.select('permissions')
			.eq('id', caller.id)
			.single();

		const hasSettingsFull =
			callerProfile?.permissions?.settings === 'full' ||
			caller.user_metadata?.permissions?.settings === 'full';

		if (!isSuperAdmin && !hasSettingsFull) {
			return jsonResponse({ error: 'Yetkisiz: Bu işlem için yetkiniz yok' }, 403);
		}

		const body = await req.json();
		const { action, userId, payload } = body;

		if (action === 'update_permissions') {
			if (!userId || !payload?.permissions) {
				return jsonResponse({ error: 'userId ve permissions gerekli' }, 400);
			}

			const { permissions, user_metadata } = payload;

			const { data: metaData, error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
				user_metadata: { ...user_metadata, permissions },
			});

			if (metaErr) {
				console.error('updateUserById error:', metaErr);
				return jsonResponse({ error: `user_metadata güncellenemedi: ${metaErr.message}` }, 400);
			}

			const { data: profileData, error: profileErr } = await supabaseAdmin
				.from('profiles')
				.update({ permissions })
				.eq('id', userId)
				.select('id, permissions');

			if (profileErr) {
				console.error('profiles update error:', profileErr);
				return jsonResponse({ error: `profiles güncellenemedi: ${profileErr.message}` }, 500);
			}

			console.log('update_permissions OK:', {
				userId,
				metaUpdated: !!metaData?.user,
				profileRows: profileData?.length ?? 0,
				savedPermissions: permissions,
			});

			return jsonResponse({
				success: true,
				debug: {
					metaUpdated: !!metaData?.user,
					profileRows: profileData?.length ?? 0,
				},
			});
		}

		if (action === 'update_password') {
			const { newPassword } = payload || {};
			if (!userId || !newPassword || newPassword.length < 6) {
				return jsonResponse({ error: 'userId ve en az 6 karakterli newPassword gerekli' }, 400);
			}

			const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
				password: newPassword,
			});

			if (error) {
				return jsonResponse({ error: error.message }, 400);
			}

			return jsonResponse({ success: true });
		}

		if (action === 'delete_user') {
			if (!userId) {
				return jsonResponse({ error: 'userId gerekli' }, 400);
			}

			if (payload?.email === SUPER_ADMIN_EMAIL) {
				return jsonResponse({ error: 'Ana admin hesabı silinemez' }, 403);
			}

			const { error: cleanupErr } = await supabaseAdmin.rpc('cleanup_user_references', {
				target_user_id: userId,
			});
			if (cleanupErr) {
				console.log('cleanup_user_references:', cleanupErr.message);
			}

			const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
			if (error) {
				return jsonResponse({ error: `Kullanıcı silinemedi: ${error.message}` }, 400);
			}

			return jsonResponse({ success: true });
		}

		return jsonResponse({ error: `Bilinmeyen action: ${action}` }, 400);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Beklenmeyen hata';
		console.error('manage-user error:', err);
		return jsonResponse({ error: message }, 500);
	}
}
