/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_GIT_COMMIT: string
  readonly VITE_BUILD_TIME: string
}
