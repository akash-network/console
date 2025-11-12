"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasSomeParentTheClass = hasSomeParentTheClass;
exports.addScriptToHead = addScriptToHead;
exports.addScriptToBody = addScriptToBody;
exports.downloadCsv = downloadCsv;
// returns true if the element or one of its parents has the class classname
function hasSomeParentTheClass(element, classname) {
    var _a;
    if (((_a = element.className) === null || _a === void 0 ? void 0 : _a.split) && element.className.split(" ").indexOf(classname) >= 0)
        return true;
    return !!element.parentNode && hasSomeParentTheClass(element.parentNode, classname);
}
function scriptExists(id) {
    return !!document.getElementById(id);
}
function createScriptElement(options) {
    var script = document.createElement("script");
    Object.assign(script, options);
    return script;
}
/**
 * Adds a script tag to the document head
 * @param options Configuration object for the script element
 * @returns The created script element or null if script with same ID already exists
 */
function addScriptToHead(options) {
    if (options.id && scriptExists(options.id)) {
        return null;
    }
    var script = createScriptElement(options);
    document.head.insertBefore(script, document.head.firstChild);
    return script;
}
/**
 * Adds a script tag to the document body
 * @param options Configuration object for the script element
 * @returns The created script element or null if script with same ID already exists
 */
function addScriptToBody(options) {
    if (options.id && scriptExists(options.id)) {
        return null;
    }
    var script = createScriptElement(options);
    document.body.insertBefore(script, document.body.firstChild);
    return script;
}
function downloadCsv(blob, filename) {
    if (filename === void 0) { filename = "export"; }
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "".concat(filename, ".csv"));
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
