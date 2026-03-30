export class Terminal {
  options = {};
  open() {}
  dispose() {}
  write() {}
  clear() {}
  reset() {}
  focus() {}
  loadAddon() {}
  attachCustomKeyEventHandler() {}
  getSelection() {
    return "";
  }
  onBinary() {
    return { dispose() {} };
  }
  onCursorMove() {
    return { dispose() {} };
  }
  onData() {
    return { dispose() {} };
  }
  onKey() {
    return { dispose() {} };
  }
  onLineFeed() {
    return { dispose() {} };
  }
  onScroll() {
    return { dispose() {} };
  }
  onSelectionChange() {
    return { dispose() {} };
  }
  onRender() {
    return { dispose() {} };
  }
  onResize() {
    return { dispose() {} };
  }
  onTitleChange() {
    return { dispose() {} };
  }
}
