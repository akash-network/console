const MODAL_SELECTOR = '[role="dialog"], [role="alertdialog"]';

/** A modal keeps focus inside itself, so a scratch field outside it never gets the focus and the copy command takes whatever the modal has selected. */
function findScratchFieldHost(): HTMLElement {
  return document.activeElement?.closest<HTMLElement>(MODAL_SELECTOR) ?? document.body;
}

function fallbackCopyTextToClipboard(text: string): boolean {
  const previouslyFocused = document.activeElement;
  const host = findScratchFieldHost();
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  host.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.activeElement === textArea && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    host.removeChild(textArea);
    if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
  }
}

/** Copies text to the clipboard, resolving to whether the write actually succeeded (including the legacy fallback path). */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!navigator.clipboard) {
    return fallbackCopyTextToClipboard(text);
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
