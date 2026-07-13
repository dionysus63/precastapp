/**
 * Client-side handling for Explorer opens that the server couldn't perform
 * because the browser is on a different machine (office workstations).
 * Inside the desktop shell the path opens via the shell bridge; in a plain
 * browser the path is copied so the user can paste it into Explorer.
 */

declare global {
  interface Window {
    precastOpsDesktop?: {
      /** Resolves to "" on success or a readable error message. */
      openPath: (targetPath: string) => Promise<string>;
    };
  }
}

export type OpenOnClientOutcome = {
  opened: boolean;
  message: string | null;
};

/**
 * Standard completion for Explorer-open actions: server already opened it
 * (local dev), the desktop shell opens it here, or the browser shows the
 * path. Returns exactly one of success/error for the button's feedback.
 */
export async function completeExplorerOpen(
  result: { launched: boolean; path: string },
  openedLabel: string,
): Promise<{ success?: string; error?: string }> {
  if (result.launched) {
    return { success: `Opened in Explorer: ${openedLabel}` };
  }
  const outcome = await openPathOnClient(result.path);
  if (outcome.opened) {
    return { success: `Opened: ${openedLabel}` };
  }
  if (outcome.message?.startsWith("Could not")) {
    return { error: outcome.message };
  }
  return { success: outcome.message ?? undefined };
}

export async function openPathOnClient(
  clientOpenPath: string,
): Promise<OpenOnClientOutcome> {
  if (typeof window !== "undefined" && window.precastOpsDesktop?.openPath) {
    try {
      const error = await window.precastOpsDesktop.openPath(clientOpenPath);
      if (error) {
        return { opened: false, message: `Could not open: ${error}` };
      }
      return { opened: true, message: null };
    } catch {
      return {
        opened: false,
        message: `Could not open ${clientOpenPath} from the desktop app.`,
      };
    }
  }

  let copied = false;
  try {
    await navigator.clipboard.writeText(clientOpenPath);
    copied = true;
  } catch {
    // Clipboard needs a secure context or permission; the path still shows.
  }
  return {
    opened: false,
    message: copied
      ? `Path copied — paste into File Explorer on your PC: ${clientOpenPath}`
      : `Open this path in File Explorer on your PC: ${clientOpenPath}`,
  };
}
