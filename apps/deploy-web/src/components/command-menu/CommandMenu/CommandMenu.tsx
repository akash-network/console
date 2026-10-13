"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import type { CommandAction } from "../commandMenuCatalog";
import { CommandMenuDialog } from "../CommandMenuDialog/CommandMenuDialog";
import { CommandMenuTrigger } from "../CommandMenuTrigger/CommandMenuTrigger";
import { ShortcutsSheet } from "../ShortcutsSheet/ShortcutsSheet";
import { useGlobalShortcuts } from "../useGlobalShortcuts";
import { useStartDeployment } from "../useStartDeployment";

export const DEPENDENCIES = { CommandMenuTrigger, CommandMenuDialog, ShortcutsSheet, useGlobalShortcuts, useStartDeployment, useRouter };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export function CommandMenu({ dependencies: d = DEPENDENCIES }: Props) {
  const { analyticsService } = useServices();
  const router = d.useRouter();
  const startDeployment = d.useStartDeployment();
  const [isOpen, setIsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const openMenu = (via: "button" | "shortcut") => {
    analyticsService.track("command_menu_opened", { via });
    setIsShortcutsOpen(false);
    setIsOpen(true);
  };

  const showShortcuts = () => {
    setIsOpen(false);
    setIsShortcutsOpen(true);
  };

  const recordShortcut = (action: CommandAction) => analyticsService.track("command_menu_action_ran", { action, via: "shortcut" });

  d.useGlobalShortcuts({
    onToggleMenu: () => (isOpen ? setIsOpen(false) : openMenu("shortcut")),
    onShowShortcuts: () => {
      recordShortcut("keyboard_shortcuts");
      showShortcuts();
    },
    onStartDeployment: command => {
      recordShortcut(command.action);
      startDeployment(command.kind);
    },
    onGoTo: page => {
      recordShortcut(`go_to_${page.id}`);
      router.push(page.href);
    }
  });

  return (
    <>
      <d.CommandMenuTrigger onClick={() => openMenu("button")} />
      <d.CommandMenuDialog isOpen={isOpen} onOpenChange={setIsOpen} onShowShortcuts={showShortcuts} />
      <d.ShortcutsSheet isOpen={isShortcutsOpen} onOpenChange={setIsShortcutsOpen} />
    </>
  );
}
