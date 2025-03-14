import { buildCommand } from "./sdlGenerator";

describe("sdlGenerator", () => {
  describe("buildCommand", () => {
    it("returns empty string for an empty string", () => {
      expect(buildCommand("")).toEqual("");
    });

    it("returns string if command is a single line string", () => {
      expect(buildCommand("echo 'foo'")).toEqual("echo 'foo'");
    });

    it("returns array starting with sh -c when it starts with sh -c", () => {
      expect(buildCommand("sh -c foo")).toEqual(["sh", "-c", "foo\n"]);
    });

    it("returns array containing only sh -c when it is only with sh -c", () => {
      expect(buildCommand("sh -c")).toEqual(["sh", "-c"]);
    });

    it("returns array starting with sh -c for a multi-line string", () => {
      expect(buildCommand("foo\nbar")).toEqual(["sh", "-c", "foo\nbar\n"]);
    });

    it("returns array starting with sh -c for a multi-line string with a newline at the end", () => {
      expect(buildCommand("foo\nbar\n")).toEqual(["sh", "-c", "foo\nbar\n"]);
    });

    it("returns array starting with sh -c for a multi-line string with multiple newlines at the end", () => {
      expect(buildCommand("foo\nbar\n\n")).toEqual(["sh", "-c", "foo\nbar\n"]);
    });
  });
});
