# astro-loader-umami

An Astro content loader that loads page view counts from [Umami](https://umami.is) when the site builds. Use it to rank posts by popularity, show a "most read" list, or sort pages by traffic, all on a static site.

## Install

```sh
npm install astro-loader-umami
```

## Usage

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { umamiLoader } from 'astro-loader-umami';

const pageviews = defineCollection({
  loader: umamiLoader({
    endpoint: 'https://analytics.example.com',
    websiteId: 'your-website-id',
    apiKey: import.meta.env.UMAMI_API_KEY,
    prefix: '/blog/',
  }),
});

export const collections = { pageviews };
```

Each entry is keyed by its normalized path, with no trailing slash, query string or hash:

```astro
---
import { getCollection, getEntry } from 'astro:content';

const all = await getCollection('pageviews');
const post = await getEntry('pageviews', '/blog/my-post'); // { path, views } or undefined
---
```

## Options

| Option      | Env fallback       | Default | Description                     |
| ----------- | ------------------ | ------- | ------------------------------- |
| `endpoint`  | `UMAMI_ENDPOINT`   | —       | Umami instance URL              |
| `websiteId` | `UMAMI_WEBSITE_ID` | —       | Website ID                      |
| `apiKey`    | `UMAMI_API_KEY`    | —       | API key                         |
| `username`  | `UMAMI_USERNAME`   | —       | Username (self-hosted)          |
| `password`  | `UMAMI_PASSWORD`   | —       | Password (self-hosted)          |
| `prefix`    | —                  | `/`     | Only load paths with this prefix |
| `days`      | —                  | `30`    | Number of days to look back     |
| `limit`     | —                  | `500`   | Maximum number of paths to load |

Use `apiKey`, or `username` and `password` for self-hosted instances without API keys. Env fallbacks read from `process.env`. Variables in `.env` are not in `process.env`, so pass those in from `import.meta.env` yourself.

## Failure behaviour

A missing credential or a failed request logs a warning and leaves the collection as it was. The build never fails because of analytics. Handle an empty collection in your pages.

## Freshness

The data is only as fresh as your last build. Rebuild on a schedule to keep it current, for example with a daily cron that calls your host's deploy hook.
