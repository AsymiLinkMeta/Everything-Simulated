/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Public origin for canonicals, OG and sitemap. Default https://www.everythingsimulated.com.au */
  readonly VITE_SITE_URL?: string;
  /** "true" on staging/previews: noindex everywhere and a Disallow-all robots.txt. */
  readonly VITE_NOINDEX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
