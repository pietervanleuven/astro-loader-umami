import { z } from 'astro/zod';

const TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Strip query strings, hashes and trailing slashes so paths match page URLs. */
export function normalizePath(path) {
	const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
	return clean || '/';
}

async function request(url, init = {}) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function authHeaders(baseUrl, { apiKey, username, password }) {
	// Umami Cloud uses API keys; self-hosted Umami uses a login token
	if (apiKey) return { 'x-umami-api-key': apiKey };
	if (!username || !password) return null;

	const res = await request(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password }),
	});
	if (!res.ok) throw new Error(`login failed (${res.status})`);
	const { token } = await res.json();
	return { Authorization: `Bearer ${token}` };
}

async function fetchMetrics(baseUrl, websiteId, headers, days, limit) {
	const endAt = Date.now();
	const startAt = endAt - days * DAY_MS;
	const params = `startAt=${startAt}&endAt=${endAt}&limit=${limit}`;

	// Newer Umami versions use type=path, older v2 releases use type=url
	let lastStatus;
	for (const type of ['path', 'url']) {
		const res = await request(
			`${baseUrl}/api/websites/${websiteId}/metrics?type=${type}&${params}`,
			{ headers },
		);
		if (res.ok) return res.json();
		lastStatus = res.status;
	}
	throw new Error(`metrics request failed (${lastStatus})`);
}

/**
 * Loads page views per path from Umami into a content collection.
 * Entries are keyed by normalized path, e.g. `/writing/2026/02/my-post`.
 *
 * @param {import('./index.d.ts').UmamiLoaderOptions} options
 * @returns {import('astro/loaders').Loader}
 */
export function umamiLoader(options = {}) {
	const env = process.env;
	const baseUrl = (options.endpoint ?? env.UMAMI_ENDPOINT ?? '').replace(/\/+$/, '');
	const websiteId = options.websiteId ?? env.UMAMI_WEBSITE_ID;
	const credentials = {
		apiKey: options.apiKey ?? env.UMAMI_API_KEY,
		username: options.username ?? env.UMAMI_USERNAME,
		password: options.password ?? env.UMAMI_PASSWORD,
	};
	const days = options.days ?? 30;
	const limit = options.limit ?? 500;
	const prefix = options.prefix ?? '/';

	return {
		name: 'umami-loader',
		schema: z.object({
			path: z.string(),
			views: z.number(),
		}),
		async load({ store, logger, parseData }) {
			if (!baseUrl || !websiteId) {
				logger.warn('Missing Umami endpoint or websiteId, skipping.');
				return;
			}

			let metrics;
			try {
				const headers = await authHeaders(baseUrl, credentials);
				if (!headers) {
					logger.warn('No Umami credentials set, skipping.');
					return;
				}
				metrics = await fetchMetrics(baseUrl, websiteId, headers, days, limit);
			} catch (error) {
				// Keep whatever the store already holds; analytics should never break a build
				logger.warn(`Could not fetch Umami page views: ${error.message}`);
				return;
			}

			const views = new Map();
			for (const { x, y } of metrics) {
				const path = normalizePath(x);
				if (!path.startsWith(prefix)) continue;
				views.set(path, (views.get(path) ?? 0) + y);
			}

			store.clear();
			for (const [path, count] of views) {
				const data = await parseData({ id: path, data: { path, views: count } });
				store.set({ id: path, data });
			}
			logger.info(`Loaded views for ${views.size} paths under ${prefix} (last ${days} days).`);
		},
	};
}
