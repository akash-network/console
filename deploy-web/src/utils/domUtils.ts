// returns true if the element or one of its parents has the class classname
export function hasSomeParentTheClass(element: HTMLElement, classname: string) {
  if (element.className?.split(" ").indexOf(classname) >= 0) return true;
  return element.parentNode && hasSomeParentTheClass(element.parentNode as HTMLElement, classname);
}
