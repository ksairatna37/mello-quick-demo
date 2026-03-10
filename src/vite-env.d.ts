/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HUME_API_KEY: string;
  readonly VITE_HUME_CONFIG_ID?: string;
  readonly VITE_AZURE_OPENAI_KEY?: string;
  readonly VITE_AZURE_OPENAI_ENDPOINT?: string;
  readonly VITE_AZURE_DEPLOYMENT_NAME?: string;
  readonly VITE_AZURE_API_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
