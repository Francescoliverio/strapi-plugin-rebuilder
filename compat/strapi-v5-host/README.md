# Strapi 5 Smoke Host

This folder contains a minimal Strapi 5 application used to validate that the local `nexjs-rebuilder` plugin can still:

- build its admin panel
- load on the server side
- register as a local plugin in a real Strapi 5 host

It is not intended to be a production app.

## Purpose

The main repository still runs on Strapi 4, so this host exists only to verify Strapi 5 compatibility without disturbing the main application.

## Plugin wiring

The local plugin is mounted from:

```text
../../..
```

See:

- `config/plugins.js`

## Useful commands

Install dependencies:

```bash
npm install
```

Run the build smoke test:

```bash
HOME=$PWD/.home npm run build
```

Load the runtime without binding a network port:

```bash
HOME=$PWD/.home node -e "const { compileStrapi, createStrapi } = require('@strapi/strapi'); (async()=>{ const ctx = await compileStrapi(); const app = await createStrapi(ctx).load(); console.log(Object.keys(app.plugins)); await app.destroy(); })()"
```

## Notes

- `HOME=$PWD/.home` keeps Strapi user-level config inside this folder during smoke tests.
- `includeUnparsed: true` is enabled so GitHub webhook signature verification can still be exercised in this host.
- Runtime artifacts such as `.home`, `.strapi`, `.tmp`, `dist`, and `node_modules` are intentionally ignored.
