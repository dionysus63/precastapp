/**
 * Page-wide record of screens with unsaved edits (registered by
 * useUnsavedChangesWarning), so app-level code — the new-version check — can
 * tell whether reloading would throw work away.
 *
 * Client-only module state; one browser tab = one page = one registry.
 */
let dirtyScreens = 0;
let unloadAllowed = false;

export function registerUnsavedChanges(): () => void {
  dirtyScreens += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      dirtyScreens = Math.max(0, dirtyScreens - 1);
    }
  };
}

export function hasUnsavedChanges(): boolean {
  return dirtyScreens > 0;
}

/**
 * Let the next unload through without the "discard changes?" guard — used
 * when the user explicitly chose to reload. In the desktop shell a guarded
 * reload is otherwise cancelled silently.
 */
export function allowUnload(): void {
  unloadAllowed = true;
}

export function isUnloadAllowed(): boolean {
  return unloadAllowed;
}
