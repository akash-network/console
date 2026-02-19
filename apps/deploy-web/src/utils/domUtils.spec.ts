import { describe, expect, it, type Mock, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { addScriptToHead, downloadCsv } from "@src/utils/domUtils";

describe("domUtils", () => {
  describe("addScriptToHead", () => {
    function setup() {
      document.head.innerHTML = "";
    }

    it("should add a script to the head", () => {
      setup();
      const scriptOptions = { src: "https://example.com/script.js", id: "test-script" };
      const script = addScriptToHead(scriptOptions);
      expect(script).not.toBeNull();
      expect(document.head.querySelector("#test-script")).toBe(script);
      expect(script?.src).toBe("https://example.com/script.js");
    });

    it("should not add a duplicate script to the head", () => {
      setup();
      const scriptOptions = { src: "https://example.com/script.js", id: "test-script" };
      const firstScript = addScriptToHead(scriptOptions);
      const secondScript = addScriptToHead(scriptOptions);
      expect(firstScript).not.toBeNull();
      expect(secondScript).toBeNull();
      expect(document.head.querySelectorAll("#test-script").length).toBe(1);
    });
  });

  describe("downloadCsv", () => {
    function setup() {
      const createObjectURLMock = vi.fn();
      const revokeObjectURLMock = vi.fn();
      const setAttributeMock = vi.fn();
      const appendChildMock = vi.fn();
      const removeChildMock = vi.fn();

      (global.URL.createObjectURL as Mock) = createObjectURLMock;
      (global.URL.revokeObjectURL as Mock) = revokeObjectURLMock;

      const originalCreateElement = document.createElement.bind(document);
      const linkMock = mock<HTMLLinkElement>({
        setAttribute: setAttributeMock,
        style: {},
        click: vi.fn()
      });
      const createElementMock = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "a") {
          return linkMock;
        }
        return originalCreateElement(tagName);
      });

      vi.spyOn(document.body, "appendChild").mockImplementation(appendChildMock);
      vi.spyOn(document.body, "removeChild").mockImplementation(removeChildMock);

      return {
        createObjectURLMock,
        setAttributeMock,
        appendChildMock,
        removeChildMock,
        createElementMock
      };
    }

    it("should create a download link and trigger click", () => {
      const { createObjectURLMock, setAttributeMock, appendChildMock, removeChildMock, createElementMock } = setup();

      const blob = new Blob(["test,data"], { type: "text/csv" });
      const filename = "myfile";
      const fakeUrl = "blob:http://example.com/fake-url";
      createObjectURLMock.mockReturnValue(fakeUrl);

      downloadCsv(blob, filename);

      expect(createObjectURLMock).toHaveBeenCalledWith(blob);
      expect(createElementMock).toHaveBeenCalledWith("a");
      expect(setAttributeMock).toHaveBeenCalledWith("href", fakeUrl);
      expect(setAttributeMock).toHaveBeenCalledWith("download", `${filename}.csv`);
      expect(appendChildMock).toHaveBeenCalled();
      expect(removeChildMock).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
    });
  });
});
