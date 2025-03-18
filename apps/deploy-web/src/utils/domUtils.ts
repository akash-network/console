// returns true if the element or one of its parents has the class classname
export function hasSomeParentTheClass(element: HTMLElement, classname: string): boolean {
  if (element.className?.split && element.className.split(" ").indexOf(classname) >= 0) return true;
  return !!element.parentNode && hasSomeParentTheClass(element.parentNode as HTMLElement, classname);
}

interface ScriptOptions {
  src: string;
  async?: boolean;
  defer?: boolean;
  type?: string;
  crossOrigin?: string;
  integrity?: string;
  noModule?: boolean;
  referrerPolicy?: ReferrerPolicy;
  id?: string;
}

/**
 * Adds a script tag to the document head
 * @param options Configuration object for the script element
 * @returns The created script element
 */
export function addScriptToHead(options: ScriptOptions): HTMLScriptElement {
  const script = document.createElement("script");

  Object.assign(script, options);
  document.head.appendChild(script);
  return script;
}
