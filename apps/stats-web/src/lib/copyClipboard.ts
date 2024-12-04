import { LoggerService } from "@akashnetwork/logging";

const clipboardLogger = LoggerService.forContext("apps/stats-web/src/lib/copyClipboard.ts");

function fallbackCopyTextToClipboard(text: string) {
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
    const successful = document.execCommand("copy");
    const msg = successful ? "successful" : "unsuccessful";
    clipboardLogger.debug("Fallback: Copying text command was " + msg);
  } catch (err) {
    clipboardLogger.debug(`Fallback: Oops, unable to copy: ${err}`);
  }

  document.body.removeChild(textArea);
}
export const copyTextToClipboard = (text: string) => {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => {
      clipboardLogger.debug("Async: Copying to clipboard was successful!");
    },
    err => {
      clipboardLogger.debug(`Async: Could not copy text: ${err}`);
    }
  );
};
