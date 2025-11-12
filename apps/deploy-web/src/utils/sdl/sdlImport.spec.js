"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("node:fs");
var path = require("node:path");
var sdlImport_1 = require("./sdlImport");
describe("sdlImport", function () {
    describe("parseSvcCommand", function () {
        it("returns empty string if command is not provided", function () {
            expect((0, sdlImport_1.parseSvcCommand)()).toEqual("");
        });
        it("returns empty string if command is empty string", function () {
            expect((0, sdlImport_1.parseSvcCommand)("")).toEqual("");
        });
        it("returns empty string if command is empty array", function () {
            expect((0, sdlImport_1.parseSvcCommand)([])).toEqual("");
        });
        it("returns command as string if command is string", function () {
            expect((0, sdlImport_1.parseSvcCommand)("echo 'foo'")).toEqual("echo 'foo'");
        });
        it("returns command as string if command is array of string", function () {
            expect((0, sdlImport_1.parseSvcCommand)(["echo", "foo"])).toEqual("echo\nfoo");
        });
        it("returns command as string if command is array of string, drops empty lines", function () {
            expect((0, sdlImport_1.parseSvcCommand)(["echo", "", "foo"])).toEqual("echo\nfoo");
        });
        it("returns command as string if command is array of strings with sh -c", function () {
            expect((0, sdlImport_1.parseSvcCommand)(["sh", "-c", "echo 'foo'"])).toEqual("echo 'foo'");
        });
        it("returns rest of command as string if command is array of strings with sh -c", function () {
            expect((0, sdlImport_1.parseSvcCommand)(["sh", "-c", "echo 'foo'", "echo 'bar'"])).toEqual("echo 'foo'\necho 'bar'");
        });
        it("returns rest of command as string if command is array of strings with sh -c, drops empty lines", function () {
            expect((0, sdlImport_1.parseSvcCommand)(["sh", "-c", "echo 'foo'", "", "echo 'bar'"])).toEqual("echo 'foo'\necho 'bar'");
        });
    });
    describe("importSimpleSdl", function () {
        it("returns services in the same order as in the SDL YAML", function () {
            var yml = fs.readFileSync(path.resolve(__dirname, "../../../tests/mocks/two-services-sdl.yml"), "utf8");
            var services = (0, sdlImport_1.importSimpleSdl)(yml);
            expect(services.map(function (service) { return service.title; })).toEqual(["web", "service-2"]);
        });
    });
});
