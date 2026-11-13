interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_LANDINGS_BASE?: string;
  readonly PUBLIC_INCLUDE_DRAFTS?: string;
  readonly PUBLIC_INCLUDE_FIXTURES?: string;
  readonly PUBLIC_LEADS_ENABLED?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
