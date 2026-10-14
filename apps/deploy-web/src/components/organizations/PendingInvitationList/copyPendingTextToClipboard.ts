import { copyTextToClipboard } from "@akashnetwork/ui/utils";

/** Safari only allows a clipboard write that starts inside the user's click, so the write begins while the text is still being fetched. */
export async function copyPendingTextToClipboard(pendingText: Promise<string>): Promise<boolean> {
  if (await writePendingClipboardItem(pendingText)) return true;

  return copyTextToClipboard(await pendingText);
}

async function writePendingClipboardItem(pendingText: Promise<string>): Promise<boolean> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;

  try {
    const pendingBlob = pendingText.then(text => new Blob([text], { type: "text/plain" }));
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": pendingBlob })]);
    return true;
  } catch {
    return false;
  }
}
