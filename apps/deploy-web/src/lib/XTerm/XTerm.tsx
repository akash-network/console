"use client";
import "@xterm/xterm/css/xterm.css";

import type { Ref } from "react";
import { useEffect, useRef } from "react";
import React from "react";
import { cn } from "@akashnetwork/ui/utils";
import { FitAddon } from "@xterm/addon-fit";
import type { IDisposable, ITerminalAddon, ITerminalOptions } from "@xterm/xterm";
import { Terminal } from "@xterm/xterm";
import { useTheme } from "next-themes";

import { copyTextToClipboard } from "@src/utils/copyClipboard";

export interface IProps {
  /**
   * Class name to add to the terminal container.
   */
  className?: string;

  /**
   * Options to initialize the terminal with.
   */
  options?: ITerminalOptions;

  /**
   * An array of XTerm addons to load along with the terminal.
   */
  addons?: Array<ITerminalAddon>;

  /**
   * Adds an event listener for when a binary event fires. This is used to
   * enable non UTF-8 conformant binary messages to be sent to the backend.
   * Currently this is only used for a certain type of mouse reports that
   * happen to be not UTF-8 compatible.
   * The event value is a JS string, pass it to the underlying pty as
   * binary data, e.g. `pty.write(Buffer.from(data, 'binary'))`.
   */
  onBinary?(data: string): void;

  /**
   * Adds an event listener for the cursor moves.
   */
  onCursorMove?(): void;

  /**
   * Adds an event listener for when a data event fires. This happens for
   * example when the user types or pastes into the terminal. The event value
   * is whatever `string` results, in a typical setup, this should be passed
   * on to the backing pty.
   */
  onData?(data: string): void;

  /**
   * Adds an event listener for when a key is pressed. The event value contains the
   * string that will be sent in the data event as well as the DOM event that
   * triggered it.
   */
  onKey?(event: { key: string; domEvent: KeyboardEvent }): void;

  /**
   * Adds an event listener for when a line feed is added.
   */
  onLineFeed?(): void;

  /**
   * Adds an event listener for when a scroll occurs. The event value is the
   * new position of the viewport.
   * @returns an `IDisposable` to stop listening.
   */
  onScroll?(newPosition: number): void;

  /**
   * Adds an event listener for when a selection change occurs.
   */
  onSelectionChange?(): void;

  /**
   * Adds an event listener for when rows are rendered. The event value
   * contains the start row and end rows of the rendered area (ranges from `0`
   * to `Terminal.rows - 1`).
   */
  onRender?(event: { start: number; end: number }): void;

  /**
   * Adds an event listener for when the terminal is resized. The event value
   * contains the new size.
   */
  onResize?(event: { cols: number; rows: number }): void;

  /**
   * Adds an event listener for when an OSC 0 or OSC 2 title change occurs.
   * The event value is the new title.
   */
  onTitleChange?(newTitle: string): void;

  /**
   * Attaches a custom key event handler which is run before keys are
   * processed, giving consumers of xterm.js ultimate control as to what keys
   * should be processed by the terminal and what keys should not.
   *
   * @param event The custom KeyboardEvent handler to attach.
   * This is a function that takes a KeyboardEvent, allowing consumers to stop
   * propagation and/or prevent the default action. The function returns
   * whether the event should be processed by xterm.js.
   */
  customKeyEventHandler?(event: KeyboardEvent): boolean;

  /**
   * Component ref
   */
  customRef?: Ref<unknown>;

  /**
   * Event handler to handle pasting in the terminal
   */
  onTerminalPaste?: (value: string) => void;
}

export type XTermRefType = {
  write: (data: string | Uint8Array, callback?: () => void) => void;
  loadAddon: (addon: ITerminalAddon) => void;
  clear: () => void;
  reset: () => void;
  focus: () => void;
};

const XTerm: React.FunctionComponent<IProps> = props => {
  const { resolvedTheme } = useTheme();
  const terminalEleRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  React.useImperativeHandle(props.customRef, () => ({
    write: (data: string | Uint8Array, callback?: () => void) => terminalRef.current?.write(data, callback),
    loadAddon: (addon: ITerminalAddon) => terminalRef.current?.loadAddon(addon),
    clear: () => terminalRef.current?.clear(),
    reset: () => terminalRef.current?.reset(),
    focus: () => terminalRef.current?.focus()
  }));

  useEffect(() => {
    if (!terminalEleRef.current) return;

    const terminal = new Terminal({
      ...props.options,
      theme: getTheme(resolvedTheme),
      cursorBlink: true
    });

    terminal.attachCustomKeyEventHandler((keyEvent: KeyboardEvent) => {
      if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.code === "KeyV" && keyEvent.type === "keydown") {
        if (props.onTerminalPaste) {
          navigator.clipboard.readText().then(
            value => props.onTerminalPaste && props.onTerminalPaste(value),
            err => {
              console.error("Async: Could not read text from clipboard: ", err);
            }
          );
        }
      }

      if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.code === "KeyC" && keyEvent.type === "keydown") {
        const selection = terminal.getSelection();
        if (selection) {
          copyTextToClipboard(selection);
          return false;
        }
      }

      if (props.customKeyEventHandler) {
        return props.customKeyEventHandler(keyEvent);
      }

      return true;
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    if (props.addons) {
      props.addons.forEach(addon => {
        terminal.loadAddon(addon);
      });
    }

    terminal.open(terminalEleRef.current);
    terminalRef.current = terminal;

    try {
      fitAddon.fit();
    } catch {
      // Fit can fail if the renderer is not yet attached due to a race condition
      // in xterm.js (Viewport._innerRefresh accesses renderer dimensions).
    }

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // Terminal may be mid-disposal during a resize callback.
      }
    });
    resizeObserver.observe(terminalEleRef.current);

    return () => {
      resizeObserver.disconnect();
      fitAddon.dispose();
      fitAddonRef.current = null;
      terminal.dispose();
      terminalRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = getTheme(resolvedTheme);
    }
  }, [resolvedTheme]);

  useEffect(() => disposable(props.onBinary && terminalRef.current?.onBinary(props.onBinary)), [props.onBinary]);
  useEffect(() => disposable(props.onCursorMove && terminalRef.current?.onCursorMove(props.onCursorMove)), [props.onCursorMove]);
  useEffect(() => disposable(props.onData && terminalRef.current?.onData(props.onData)), [props.onData]);
  useEffect(() => disposable(props.onKey && terminalRef.current?.onKey(props.onKey)), [props.onKey]);
  useEffect(() => disposable(props.onLineFeed && terminalRef.current?.onLineFeed(props.onLineFeed)), [props.onLineFeed]);
  useEffect(() => disposable(props.onScroll && terminalRef.current?.onScroll(props.onScroll)), [props.onScroll]);
  useEffect(() => disposable(props.onSelectionChange && terminalRef.current?.onSelectionChange(props.onSelectionChange)), [props.onSelectionChange]);
  useEffect(() => disposable(props.onRender && terminalRef.current?.onRender(props.onRender)), [props.onRender]);
  useEffect(() => disposable(props.onResize && terminalRef.current?.onResize(props.onResize)), [props.onResize]);
  useEffect(() => disposable(props.onTitleChange && terminalRef.current?.onTitleChange(props.onTitleChange)), [props.onTitleChange]);

  return <div className={cn(props.className, "h-full [&>.terminal]:h-full")} ref={terminalEleRef} />;
};

export default XTerm;

function disposable(value: IDisposable | undefined) {
  if (!value) return;
  return () => value.dispose();
}

function getTheme(resolvedTheme: string | undefined) {
  const isDark = resolvedTheme === "dark";
  return {
    background: isDark ? "#1e1e1e" : "white",
    foreground: isDark ? "white" : "black",
    cursor: isDark ? "white" : "black",
    cursorAccent: isDark ? "#1e1e1e" : "white",
    selectionBackground: isDark ? "white" : "black",
    selectionForeground: isDark ? "black" : "white",
    selectionInactiveBackground: isDark ? "white" : "black"
  };
}
