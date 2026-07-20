// returns true if the element or one of its parents has the class classname
export function hasSomeParentTheClass(element: HTMLElement, classname: string): boolean {
  if (element.className?.split && element.className.split(" ").indexOf(classname) >= 0) return true;
  return !!element.parentNode && hasSomeParentTheClass(element.parentNode as HTMLElement, classname);
}

interface ScriptOptions {
  src?: string;
  async?: boolean;
  defer?: boolean;
  type?: string;
  crossOrigin?: string;
  integrity?: string;
  noModule?: boolean;
  referrerPolicy?: ReferrerPolicy;
  id?: string;
  innerHTML?: string;
}

function scriptExists(id: string): boolean {
  return !!document.getElementById(id);
}

/**
 * Reads the active CSP nonce from an already-nonced script via the `.nonce` IDL property,
 * since browsers clear the `nonce` content attribute after parsing.
 */
export function getCspNonce(): string | undefined {
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce || undefined;
}

function createScriptElement(options: ScriptOptions): HTMLScriptElement {
  const script = document.createElement("script");
  Object.assign(script, options);

  const nonce = getCspNonce();
  if (nonce) {
    script.nonce = nonce;
  }

  return script;
}

/**
 * Adds a script tag to the document head
 * @param options Configuration object for the script element
 * @returns The created script element or null if script with same ID already exists
 */
export function addScriptToHead(options: ScriptOptions): HTMLScriptElement | null {
  if (options.id && scriptExists(options.id)) {
    return null;
  }

  const script = createScriptElement(options);
  document.head.insertBefore(script, document.head.firstChild);
  return script;
}

/**
 * Adds a script tag to the document body
 * @param options Configuration object for the script element
 * @returns The created script element or null if script with same ID already exists
 */
export function addScriptToBody(options: ScriptOptions): HTMLScriptElement | null {
  if (options.id && scriptExists(options.id)) {
    return null;
  }

  const script = createScriptElement(options);
  document.body.insertBefore(script, document.body.firstChild);
  return script;
}

export function downloadCsv(blob: Blob, filename = "export") {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
