import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const env = (event.platform as any)?.env;

	// Domaine principal de l'interface
	const uiDomain = env?.UI_DOMAIN?.trim().toLowerCase();

	// Redirection des domaines secondaires vers le domaine principal
	if (uiDomain) {
		const currentHost = event.url.hostname.toLowerCase();

		if (currentHost !== uiDomain) {
			const redirectUrl = new URL(event.url);

			redirectUrl.protocol = 'https:';
			redirectUrl.hostname = uiDomain;
			redirectUrl.port = '';

			return Response.redirect(redirectUrl.toString(), 301);
		}
	}

	// Transfert des requêtes API vers le Worker API
	if (event.url.pathname.startsWith('/api/')) {
		const api = env?.API;

		if (api) {
			const forwarded = new Request(
				`https://api.internal${event.url.pathname}${event.url.search}`,
				event.request,
			);

			return api.fetch(forwarded);
		}
	}

	return resolve(event);
};