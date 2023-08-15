import "xterm/css/xterm.css";
import { Terminal, ITerminalOptions, ITerminalAddon } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { Ref, useEffect, useRef } from "react";
import React from "react";
import { Box, useTheme } from "@mui/material";
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
  const theme = useTheme();
  /**
   * The ref for the containing element.
   */
  const terminalEleRef = useRef<HTMLDivElement>(null);
  /**
   * XTerm.js Terminal object.
   */
  const terminalRef = useRef<Terminal>(null);

  React.useImperativeHandle(props.customRef, () => ({
    write: (data: string | Uint8Array, callback?: () => void) => terminalRef.current.write(data, callback),
    loadAddon: (addon: ITerminalAddon) => terminalRef.current.loadAddon(addon),
    clear: () => terminalRef.current.clear(),
    reset: () => terminalRef.current.reset(),
    focus: () => terminalRef.current.focus()
    // TODO more commands
  }));

  useEffect(() => {
    // Setup the XTerm terminal.
    terminalRef.current = new Terminal({
      ...props.options,
      theme: {
        background: theme.palette.mode === "dark" ? "#1e1e1e" : "white",
        foreground: theme.palette.mode === "dark" ? "white" : "black",
        cursor: theme.palette.mode === "dark" ? "white" : "black",
        cursorAccent: theme.palette.mode === "dark" ? "#1e1e1e" : "white"
      },
      cursorBlink: true
    });

    terminalRef.current.attachCustomKeyEventHandler((keyEvent: KeyboardEvent) => {
      // Handle pasting with ctrl or cmd + v
      if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.code === "KeyV" && keyEvent.type === "keydown") {
        if (props.onTerminalPaste) {
          navigator.clipboard.readText().then(
            value => {
              props.onTerminalPaste(value);
            },
            err => {
              console.error("Async: Could not read text from clipboard: ", err);
            }
          );
        }
      }

      // Handle pasting with ctrl or cmd + c
      if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.code === "KeyC" && keyEvent.type === "keydown") {
        const selection = terminalRef.current.getSelection();
        if (selection) {
          copyTextToClipboard(selection);
          return false;
        }
      }
      return true;
    });

    const fitAddon = new FitAddon();
    terminalRef.current.loadAddon(fitAddon);

    // Load addons if the prop exists.
    if (props.addons) {
      props.addons.forEach(addon => {
        terminalRef.current.loadAddon(addon);
      });
    }

    // Create Listeners
    terminalRef.current.onBinary(onBinary);
    terminalRef.current.onCursorMove(onCursorMove);
    terminalRef.current.onData(onData);
    terminalRef.current.onKey(onKey);
    terminalRef.current.onLineFeed(onLineFeed);
    terminalRef.current.onScroll(onScroll);
    terminalRef.current.onSelectionChange(onSelectionChange);
    terminalRef.current.onRender(onRender);
    terminalRef.current.onResize(onResize);
    terminalRef.current.onTitleChange(onTitleChange);

    // Add Custom Key Event Handler
    if (props.customKeyEventHandler) {
      terminalRef.current.attachCustomKeyEventHandler(props.customKeyEventHandler);
    }

    // Open terminal
    terminalRef.current.open(terminalEleRef.current);

    fitAddon.fit();

    return () => {
      // When the component unmounts dispose of the terminal and all of its listeners.
      terminalRef.current.dispose();
    };
  }, []);

  const onBinary = (data: string) => {
    if (props.onBinary) props.onBinary(data);
  };

  const onCursorMove = () => {
    if (props.onCursorMove) props.onCursorMove();
  };

  const onData = (data: string) => {
    if (props.onData) props.onData(data);
  };

  const onKey = (event: { key: string; domEvent: KeyboardEvent }) => {
    if (props.onKey) props.onKey(event);
  };

  const onLineFeed = () => {
    if (props.onLineFeed) props.onLineFeed();
  };

  const onScroll = (newPosition: number) => {
    if (props.onScroll) props.onScroll(newPosition);
  };

  const onSelectionChange = () => {
    if (props.onSelectionChange) props.onSelectionChange();
  };

  const onRender = (event: { start: number; end: number }) => {
    if (props.onRender) props.onRender(event);
  };

  const onResize = (event: { cols: number; rows: number }) => {
    if (props.onResize) props.onResize(event);
  };

  const onTitleChange = (newTitle: string) => {
    if (props.onTitleChange) props.onTitleChange(newTitle);
  };

  return <Box sx={{ height: "100%", "& .terminal": { height: "100%" } }} className={props.className} ref={terminalEleRef} />;
};

export default XTerm;
