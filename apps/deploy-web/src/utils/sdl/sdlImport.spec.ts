import * as fs from "node:fs";
import * as path from "node:path";

import { importSimpleSdl, parseSvcCommand } from "./sdlImport";

describe("sdlImport", () => {
  describe("parseSvcCommand", () => {
    it("returns empty string if command is not provided", () => {
      expect(parseSvcCommand()).toEqual("");
    });

    it("returns empty string if command is empty string", () => {
      expect(parseSvcCommand("")).toEqual("");
    });

    it("returns empty string if command is empty array", () => {
      expect(parseSvcCommand([])).toEqual("");
    });

    it("returns command as string if command is string", () => {
      expect(parseSvcCommand("echo 'foo'")).toEqual("echo 'foo'");
    });

    it("returns command as string if command is array of string", () => {
      expect(parseSvcCommand(["echo", "foo"])).toEqual("echo\nfoo");
    });

    it("returns command as string if command is array of string, drops empty lines", () => {
      expect(parseSvcCommand(["echo", "", "foo"])).toEqual("echo\nfoo");
    });

    it("returns command as string if command is array of strings with sh -c", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'"])).toEqual("echo 'foo'");
    });

    it("returns rest of command as string if command is array of strings with sh -c", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "echo 'bar'"])).toEqual("echo 'foo'\necho 'bar'");
    });

    it("returns rest of command as string if command is array of strings with sh -c, drops empty lines", () => {
      expect(parseSvcCommand(["sh", "-c", "echo 'foo'", "", "echo 'bar'"])).toEqual("echo 'foo'\necho 'bar'");
    });
  });

  describe("importSimpleSdl", () => {
    it("returns services in the same order as in the SDL YAML", () => {
      const yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");

      const services = importSimpleSdl(yml);

      expect(services.map(service => service.title)).toEqual(["web", "service-2"]);
    });
  });
});
