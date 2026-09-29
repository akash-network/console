import React from "react";
import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { tolerateTranslatorDomEdits } from "./tolerateTranslatorDomEdits";

import { render } from "@testing-library/react";

describe(tolerateTranslatorDomEdits.name, () => {
  describe("removeChild", () => {
    it("removes a child that is still in the parent", () => {
      const { parent, logger } = setup();
      const child = parent.appendChild(document.createElement("span"));

      const removed = parent.removeChild(child);

      expect(removed).toBe(child);
      expect(parent.contains(child)).toBe(false);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("leaves the translation in place when the child was replaced by a translator", () => {
      const { parent, logger } = setup();
      const text = parent.appendChild(document.createTextNode("Saved"));
      const translation = replaceWithTranslation(text);

      const removed = parent.removeChild(text);

      expect(removed).toBe(text);
      expect(parent.firstChild).toBe(translation);
      expect(logger.warn).toHaveBeenCalledWith({ event: "DOM_REMOVE_CHILD_NOT_IN_PARENT_SKIPPED", nodeName: "#text" });
    });
  });

  describe("insertBefore", () => {
    it("inserts before a reference that is still in the parent", () => {
      const { parent, logger } = setup();
      const reference = parent.appendChild(document.createElement("span"));
      const inserted = document.createElement("b");

      const result = parent.insertBefore(inserted, reference);

      expect(result).toBe(inserted);
      expect(parent.firstChild).toBe(inserted);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("appends when there is no reference", () => {
      const { parent, logger } = setup();
      parent.appendChild(document.createElement("span"));
      const inserted = document.createElement("b");

      parent.insertBefore(inserted, null);

      expect(parent.lastChild).toBe(inserted);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("appends when the reference was replaced by a translator", () => {
      const { parent, logger } = setup();
      const text = parent.appendChild(document.createTextNode("Redeem coupon"));
      const translation = replaceWithTranslation(text);
      const inserted = document.createElement("b");

      const result = parent.insertBefore(inserted, text);

      expect(result).toBe(inserted);
      expect(Array.from(parent.childNodes)).toEqual([translation, inserted]);
      expect(logger.warn).toHaveBeenCalledWith({ event: "DOM_INSERT_BEFORE_NODE_NOT_IN_PARENT_APPENDED", nodeName: "#text" });
    });
  });

  describe("when React updates a translated page", () => {
    it("keeps rendering when React removes text a translator replaced", () => {
      const { parent } = setup();
      const { rerender } = render(<SaveStatus isSaved />, { container: parent });
      replaceWithTranslation(parent.firstChild as Text);

      rerender(<SaveStatus isSaved={false} />);

      expect(parent.querySelector("font")).not.toBeNull();
    });

    it("keeps rendering when React inserts next to text a translator replaced", () => {
      const { parent } = setup();
      const { rerender } = render(<SubmitLabel isLoading={false} />, { container: parent });
      replaceWithTranslation(parent.firstChild as Text);

      rerender(<SubmitLabel isLoading />);

      expect(parent.querySelector("[role=status]")).not.toBeNull();
    });
  });

  function SaveStatus({ isSaved }: { isSaved: boolean }) {
    return <>{isSaved ? "Saved" : null}</>;
  }

  function SubmitLabel({ isLoading }: { isLoading: boolean }) {
    return (
      <>
        {isLoading && <span role="status" />}
        Redeem coupon
      </>
    );
  }

  function replaceWithTranslation(text: Text) {
    const outerFont = document.createElement("font");
    const innerFont = document.createElement("font");
    innerFont.textContent = text.data;
    outerFont.appendChild(innerFont);
    text.replaceWith(outerFont);
    return outerFont;
  }

  function setup() {
    const parent = document.createElement("div");
    const logger = mock<LoggerService>();
    tolerateTranslatorDomEdits(parent, logger);
    return { parent, logger };
  }
});
