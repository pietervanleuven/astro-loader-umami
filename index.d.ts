import type { Loader } from 'astro/loaders';

export interface UmamiLoaderOptions {
	/** Umami instance URL. Defaults to `UMAMI_ENDPOINT`. */
	endpoint?: string;
	/** Umami website ID. Defaults to `UMAMI_WEBSITE_ID`. */
	websiteId?: string;
	/** API key. Defaults to `UMAMI_API_KEY`. */
	apiKey?: string;
	/** Username (self-hosted Umami). Defaults to `UMAMI_USERNAME`. */
	username?: string;
	/** Password (self-hosted Umami). Defaults to `UMAMI_PASSWORD`. */
	password?: string;
	/** Only load paths starting with this prefix, e.g. `/writing/`. Defaults to `/`. */
	prefix?: string;
	/** Number of days to look back. Defaults to 30. */
	days?: number;
	/** Maximum number of paths to fetch. Defaults to 500. */
	limit?: number;
}

export interface PageViews {
	path: string;
	views: number;
}

export function normalizePath(path: string): string;

export function umamiLoader(options?: UmamiLoaderOptions): Loader;
