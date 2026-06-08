import { loadEnv } from 'vite';
import { handleManageUserRequest } from '../lib/manageUserHandler.js';

const MANAGE_USER_ROUTE = '/api/manage-user';

const readRequestBody = async (req) => {
	const chunks = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString('utf8');
};

const createManageUserPlugin = () => {
	let env = {};

	return {
		name: 'manage-user-plugin',
		config(_config, { mode }) {
			env = loadEnv(mode, process.cwd(), '');
		},
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url?.split('?')[0];
				if (url !== MANAGE_USER_ROUTE) {
					next();
					return;
				}

				try {
					const rawBody = req.method === 'POST' ? await readRequestBody(req) : undefined;
					const headers = new Headers();
					for (const [key, value] of Object.entries(req.headers)) {
						if (value != null) {
							headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
						}
					}

					const request = new Request(`http://localhost${MANAGE_USER_ROUTE}`, {
						method: req.method || 'GET',
						headers,
						body: rawBody,
					});

					const response = await handleManageUserRequest(request, env);
					const text = await response.text();

					res.statusCode = response.status;
					response.headers.forEach((value, key) => {
						res.setHeader(key, value);
					});
					res.end(text);
				} catch (err) {
					console.error('manage-user dev middleware error:', err);
					res.statusCode = 500;
					res.setHeader('Content-Type', 'application/json');
					res.end(
						JSON.stringify({
							error: err instanceof Error ? err.message : 'Beklenmeyen hata',
						})
					);
				}
			});
		},
	};
};

export default createManageUserPlugin;
