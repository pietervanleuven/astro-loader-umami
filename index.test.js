import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { umamiLoader, normalizePath } from './index.js';

function fakeUmami(handler) {
	return new Promise((resolve) => {
		const server = createServer(handler).listen(0, () => {
			resolve({ server, endpoint: `http://localhost:${server.address().port}` });
		});
	});
}

function fakeContext() {
	const entries = new Map();
	const warnings = [];
	return {
		entries,
		warnings,
		context: {
			store: {
				clear: () => entries.clear(),
				set: ({ id, data }) => entries.set(id, data),
			},
			logger: { info() {}, warn: (msg) => warnings.push(msg) },
			parseData: async ({ data }) => data,
		},
	};
}

test('normalizePath strips query, hash and trailing slash', () => {
	assert.equal(normalizePath('/writing/post/?ref=x#top'), '/writing/post');
	assert.equal(normalizePath('/'), '/');
});

test('loads views filtered by prefix, merging duplicate paths', async () => {
	let seenKey;
	const { server, endpoint } = await fakeUmami((req, res) => {
		seenKey = req.headers['x-umami-api-key'];
		res.end(JSON.stringify([
			{ x: '/writing/a', y: 10 },
			{ x: '/writing/a/', y: 5 },
			{ x: '/writing/b?utm=x', y: 3 },
			{ x: '/projects/c', y: 99 },
		]));
	});

	const { entries, context } = fakeContext();
	await umamiLoader({ endpoint, websiteId: 'site', apiKey: 'key', prefix: '/writing/' }).load(context);
	server.close();

	assert.equal(seenKey, 'key');
	assert.deepEqual(Object.fromEntries(entries), {
		'/writing/a': { path: '/writing/a', views: 15 },
		'/writing/b': { path: '/writing/b', views: 3 },
	});
});

test('falls back to type=url for older Umami versions', async () => {
	const { server, endpoint } = await fakeUmami((req, res) => {
		if (req.url.includes('type=path')) {
			res.statusCode = 400;
			return res.end();
		}
		res.end(JSON.stringify([{ x: '/a', y: 1 }]));
	});

	const { entries, context } = fakeContext();
	await umamiLoader({ endpoint, websiteId: 'site', apiKey: 'key' }).load(context);
	server.close();

	assert.equal(entries.get('/a').views, 1);
});

test('logs in with username and password when no api key is set', async () => {
	let auth;
	const { server, endpoint } = await fakeUmami((req, res) => {
		if (req.url === '/api/auth/login') return res.end(JSON.stringify({ token: 'tok' }));
		auth = req.headers.authorization;
		res.end('[]');
	});

	const { context } = fakeContext();
	await umamiLoader({ endpoint, websiteId: 'site', username: 'u', password: 'p' }).load(context);
	server.close();

	assert.equal(auth, 'Bearer tok');
});

test('keeps existing entries and warns when the request fails', async () => {
	const { server, endpoint } = await fakeUmami((req, res) => {
		res.statusCode = 500;
		res.end();
	});

	const { entries, warnings, context } = fakeContext();
	entries.set('/old', { path: '/old', views: 1 });
	await umamiLoader({ endpoint, websiteId: 'site', apiKey: 'key' }).load(context);
	server.close();

	assert.equal(entries.size, 1);
	assert.match(warnings[0], /Could not fetch/);
});

test('skips without credentials', async () => {
	const { warnings, context } = fakeContext();
	await umamiLoader({ endpoint: 'http://localhost:1', websiteId: 'site' }).load(context);
	assert.match(warnings[0], /No Umami credentials/);
});
