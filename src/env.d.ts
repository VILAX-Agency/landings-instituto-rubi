interface ImportMetaEnv {
  readonly PUBLIC_LANDINGS_BASE?: string;
  readonly PUBLIC_INCLUDE_DRAFTS?: string;
  readonly PUBLIC_INCLUDE_FIXTURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
