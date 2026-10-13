"use client";
import { useState } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { CommandMenuDialog } from "../CommandMenuDialog/CommandMenuDialog";
import { CommandMenuTrigger } from "../CommandMenuTrigger/CommandMenuTrigger";
import { useGlobalShortcuts } from "../useGlobalShortcuts";

export const DEPENDENCIES = { CommandMenuTrigger, CommandMenuDialog, useGlobalShortcuts };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function CommandMenu({ dependencies: d = DEPENDENCIES }: Props) {
  const { analyticsService } = useServices();
  const [isOpen, setIsOpen] = useState(false);

  const openMenu = (via: "button" | "shortcut") => {
    analyticsService.track("command_menu_opened", { via });
    setIsOpen(true);
  };

  d.useGlobalShortcuts({
    onToggleMenu: () => (isOpen ? setIsOpen(false) : openMenu("shortcut"))
  });

  return (
    <>
      <d.CommandMenuTrigger onClick={() => openMenu("button")} />
      <d.CommandMenuDialog isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
