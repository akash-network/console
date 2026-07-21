function fallbackCopyTextToClipboard(text: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
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
