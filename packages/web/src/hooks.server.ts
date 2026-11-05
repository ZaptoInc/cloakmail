import type { Handle } from '@sveltejs/kit';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export const handle: Handle = async ({ event, resolve }) => {
	const env = (event.platform as any)?.env;

	// Domaine principal de l'interface (variable UI_DOMAIN du worker web)
	const uiDomain = env?.UI_DOMAIN?.trim().toLowerCase();
	const currentHost = event.url.hostname.toLowerCase();

	// Redirection des domaines secondaires vers le domaine principal.
	// On ne touche pas aux hôtes locaux pour que `wrangler dev` / `vite dev` restent utilisables.
	if (uiDomain && currentHost !== uiDomain && !LOCAL_HOSTS.has(currentHost)) {
		const redirectUrl = new URL(event.url);
		redirectUrl.protocol = 'https:';
		redirectUrl.hostname = uiDomain;
		redirectUrl.port = '';

		// 301 pour les pages, 308 pour les autres méthodes (conserve POST/DELETE et le corps)
		const status = event.request.method === 'GET' || event.request.method === 'HEAD' ? 301 : 308;

		return new Response(null, {
			status,
			headers: { Location: redirectUrl.toString() }
		});
	}

	// Transfert des requêtes API vers le Worker API
	if (event.url.pathname.startsWith('/api/')) {
		const api = env?.API;

		if (api) {
			const forwarded = new Request(
				`https://api.internal${event.url.pathname}${event.url.search}`,
				event.request
			);

			return api.fetch(forwarded);
		}
	}

	return resolve(event);
};
