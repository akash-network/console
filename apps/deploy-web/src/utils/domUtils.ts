// returns true if the element or one of its parents has the class classname
export function hasSomeParentTheClass(element: HTMLElement, classname: string): boolean {
  if (element.className?.split && element.className.split(" ").indexOf(classname) >= 0) return true;
  return !!element.parentNode && hasSomeParentTheClass(element.parentNode as HTMLElement, classname);
}

/**
 * Adds a script tag to the document head
 * @param src The source URL of the script
 * @param async Whether the script should be loaded asynchronously
 * @returns The created script element
 */
export function addScriptToHead(src: string, async: boolean = true): HTMLScriptElement {
  const script = document.createElement("script");
  script.src = src;
  script.async = async;
  document.head.appendChild(script);
  return script;
}
