/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUME_API_KEY: string;
  readonly VITE_HUME_CONFIG_ID?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
