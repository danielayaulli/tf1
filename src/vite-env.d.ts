/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  // Modo prueba: permite fijar una ubicación manual (en vez de GPS real) y
  // usa una tolerancia de cercanía mayor. Ver src/lib/testMode.ts.
  readonly VITE_TEST_MODE?: string;
  readonly VITE_TEST_TOLERANCE_M?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
