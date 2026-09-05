# GDP Clothing

Standalone source copy of the GDP Clothing storefront for GitHub and Visual Studio Code.

## Separation from Base44

This repository is a one-time snapshot. It is intentionally disconnected from Base44:

- no Base44 SDK runtime
- no Base44 Vite plugin
- no Base44 API host
- no automatic synchronization back to Base44

The `base44/` directory is retained only as reference for the former data schemas and server functions. It is not executed by the standalone Vite app.

## Run in Visual Studio Code

```bash
npm install
npm run dev
```

The frontend structure, pages, components, styling, routes, cart UI, Custom Studio UI, checkout UI, account UI, and admin UI are preserved.

Backend-dependent actions such as persistent products, authentication, orders, file uploads, AI, payments, and admin writes are intentionally disabled until a new standalone backend is connected.

The local adapter at `src/api/base44Client.js` performs no network calls.

<!-- Cloudflare deployment trigger: standalone Supabase build -->
