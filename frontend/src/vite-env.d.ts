/// <reference types="vite/client" />

// Typed access to the build-time frontend configuration (Vite exposes only
// VITE_-prefixed vars). Mirrors frontend/.env.example.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
