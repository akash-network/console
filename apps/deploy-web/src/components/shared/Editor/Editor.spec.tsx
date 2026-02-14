import { Editor, EditorSkeleton } from "./Editor";

import { render } from "@testing-library/react";

describe(Editor.name || "Editor", () => {
  describe(EditorSkeleton.name, () => {
    it("renders skeleton lines with varying widths", () => {
      const result = render(<EditorSkeleton />);
      expect(result.container).toMatchSnapshot();
    });
  });
});
