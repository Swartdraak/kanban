/**
 * Application entry point.
 *
 * Wires up the storage adapter + task store, mounts the board into `#app`,
 * and disposes cleanly. This is the only file that knows about `document`
 * at the top level — everything else is imported as pure modules.
 */
import { LocalStorageAdapter } from './lib/storage.js';
import { TaskStore } from './lib/taskStore.js';
import { mountBoard } from './components/Board.js';

function bootstrap(): void {
  const adapter = new LocalStorageAdapter(window.localStorage);
  const store = new TaskStore(adapter);

  const root: HTMLElement | null = document.getElementById('app');
  if (!root) {
    // index.html is expected to contain `<div id="app"></div>`.
    if (typeof console !== 'undefined') {
      console.error('[main] #app not found — did index.html change?');
    }
    return;
  }

  const board = mountBoard(root, { store });

  // Dispose on unload (not strictly necessary for a top-level page, but
  // good hygiene if this bootstrap is ever re-used in tests).
  window.addEventListener('pagehide', () => {
    board.dispose();
  }, { once: true });
}

// Boot immediately — the script tag in index.html is `type="module"`, so this
// file runs after the DOM has been parsed.
bootstrap();
