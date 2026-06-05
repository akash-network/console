import type { FC } from "react";
import { useEffect } from "react";
import { Xmark } from "iconoir-react";

import { SDLEditor } from "@src/components/sdl/SDLEditor/SDLEditor";

export const DEPENDENCIES = { SDLEditor };

type Props = {
  sdl: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const SdlPreviewPane: FC<Props> = ({ sdl, isOpen, onOpen, onClose, dependencies: d = DEPENDENCIES }) => {
  useEffect(
    function bindSdlPreviewHotkey() {
      const toggleSdlPreview = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyY") {
          event.preventDefault();
          if (isOpen) {
            onClose();
          } else {
            onOpen();
          }
        }
      };

      window.addEventListener("keydown", toggleSdlPreview);
      return function unbindSdlPreviewHotkey() {
        window.removeEventListener("keydown", toggleSdlPreview);
      };
    },
    [isOpen, onOpen, onClose]
  );

  if (!isOpen) return null;

  return (
    <section aria-labelledby="sdl-preview-pane-heading" className="hidden h-full min-h-0 flex-col border-l-4 border-l-amber-500 md:flex">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-zinc-300 bg-amber-500/10 px-4 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <h2 id="sdl-preview-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
            SDL Preview
          </h2>
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Debug
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close SDL preview"
          className="flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-accent"
        >
          <Xmark className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <d.SDLEditor value={sdl} readonly height="100%" />
      </div>
    </section>
  );
};
