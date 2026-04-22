import * as React from 'react';
import { Button } from '@/components/ui/button';

const RELOAD_FLAG = 'kademe_chunk_reload_pending';

function isChunkOrModuleLoadError(error) {
  const msg = String(error?.message || error || '');
  return (
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    (/MIME type/i.test(msg) && /text\/html|application\/json/i.test(msg))
  );
}

function ChunkLoadRecovery() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="max-w-md text-sm text-muted-foreground">
        Modül yüklenemedi (genelde yeni bir sürüm yayınlandığında eski sayfa önbelleği buna neden olur).
      </p>
      <Button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(RELOAD_FLAG);
          window.location.reload();
        }}
      >
        Sayfayı yenile
      </Button>
    </div>
  );
}

/**
 * React.lazy ile aynı API; chunk 404 / eski deploy / HTML dönüşü durumunda bir kez tam sayfa yeniler.
 */
export function lazyWithRetry(factory) {
  return React.lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (error) {
      if (!isChunkOrModuleLoadError(error)) {
        throw error;
      }
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
        return { default: () => null };
      }
      sessionStorage.removeItem(RELOAD_FLAG);
      return { default: ChunkLoadRecovery };
    }
  });
}
