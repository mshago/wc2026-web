/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the prediction API. PUBLIC — Vite inlines it into the bundle. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
