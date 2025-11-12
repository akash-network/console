"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var sdlGenerator_1 = require("./sdlGenerator");
describe("sdlGenerator", function () {
    describe("buildCommand", function () {
        it("returns empty string for an empty string", function () {
            expect((0, sdlGenerator_1.buildCommand)("")).toEqual("");
        });
        it("returns string if command is a single line string", function () {
            expect((0, sdlGenerator_1.buildCommand)("echo 'foo'")).toEqual("echo 'foo'");
        });
        it("returns array starting with sh -c when it starts with sh -c", function () {
            expect((0, sdlGenerator_1.buildCommand)("sh -c foo")).toEqual(["sh", "-c", "foo\n"]);
        });
        it("returns array containing only sh -c when it is only with sh -c", function () {
            expect((0, sdlGenerator_1.buildCommand)("sh -c")).toEqual(["sh", "-c"]);
        });
        it("returns array starting with sh -c for a multi-line string", function () {
            expect((0, sdlGenerator_1.buildCommand)("foo\nbar")).toEqual(["sh", "-c", "foo\nbar\n"]);
        });
        it("returns array starting with sh -c for a multi-line string with a newline at the end", function () {
            expect((0, sdlGenerator_1.buildCommand)("foo\nbar\n")).toEqual(["sh", "-c", "foo\nbar\n"]);
        });
        it("returns array starting with sh -c for a multi-line string with multiple newlines at the end", function () {
            expect((0, sdlGenerator_1.buildCommand)("foo\nbar\n\n")).toEqual(["sh", "-c", "foo\nbar\n"]);
        });
    });
});
