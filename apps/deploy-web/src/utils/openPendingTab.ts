export type PendingTab = {
  navigate: (url: string) => void;
  close: () => void;
};

/** Opens the tab before the awaited request, because Safari blocks a popup that is not opened straight off the click. */
export function openPendingTab(): PendingTab {
  const tab = window.open("", "_blank");

  if (tab) {
    tab.opener = null;
  }

  return {
    navigate: url => {
      if (tab) {
        tab.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    close: () => tab?.close()
  };
}
