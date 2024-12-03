import { useLogger } from "@/hooks/useLogger";

export const useClipboard = () => {
  const libLogger = useLogger("apps/stats-web/src/lib/copyClipboard.ts");

  const fallbackCopyTextToClipboard = (text: string) => {
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
      libLogger.debug("Fallback: Copying text command was " + msg);
    } catch (err) {
      libLogger.debug(`Fallback: Oops, unable to copy: ${err}`);
    }

    document.body.removeChild(textArea);
  };

  const copyTextToClipboard = (text: string) => {
    if (!navigator.clipboard) {
      fallbackCopyTextToClipboard(text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      () => {
        libLogger.debug("Async: Copying to clipboard was successful!");
      },
      (err) => {
        libLogger.debug(`Async: Could not copy text: ${err}`);
      }
    );
  };

  return { copyTextToClipboard };
};
