import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The web app is entirely server-rendered (App Router server components,
 * server actions, cookie-based auth, route handlers, middleware) and cannot be
 * statically exported. The native shell therefore loads the DEPLOYED app over
 * the network via `server.url` rather than a bundled build.
 *
 * Before `npx cap sync`, set CAP_SERVER_URL to the deployed origin, e.g.
 *   CAP_SERVER_URL=https://inventory.malayalikada.example npx cap sync
 * When unset, the app shows the bundled `mobile/index.html` loading screen.
 *
 * A real offline-capable native build would require migrating the web app to a
 * static-export SPA (client components + browser Supabase client throughout).
 */
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.malayalikada.inventoryos",
  appName: "Malayalikada Inventory OS",
  webDir: "mobile",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          // Supabase auth / API calls go to https origins; keep cleartext off.
          cleartext: false,
        },
      }
    : {}),
};

export default config;
