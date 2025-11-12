"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jest_mock_extended_1 = require("jest-mock-extended");
var domUtils_1 = require("@src/utils/domUtils");
describe("domUtils", function () {
    describe("addScriptToHead", function () {
        function setup() {
            document.head.innerHTML = "";
        }
        it("should add a script to the head", function () {
            setup();
            var scriptOptions = { src: "https://example.com/script.js", id: "test-script" };
            var script = (0, domUtils_1.addScriptToHead)(scriptOptions);
            expect(script).not.toBeNull();
            expect(document.head.querySelector("#test-script")).toBe(script);
            expect(script === null || script === void 0 ? void 0 : script.src).toBe("https://example.com/script.js");
        });
        it("should not add a duplicate script to the head", function () {
            setup();
            var scriptOptions = { src: "https://example.com/script.js", id: "test-script" };
            var firstScript = (0, domUtils_1.addScriptToHead)(scriptOptions);
            var secondScript = (0, domUtils_1.addScriptToHead)(scriptOptions);
            expect(firstScript).not.toBeNull();
            expect(secondScript).toBeNull();
            expect(document.head.querySelectorAll("#test-script").length).toBe(1);
        });
    });
    describe("downloadCsv", function () {
        function setup() {
            var createObjectURLMock = jest.fn();
            var revokeObjectURLMock = jest.fn();
            var setAttributeMock = jest.fn();
            var appendChildMock = jest.fn();
            var removeChildMock = jest.fn();
            global.URL.createObjectURL = createObjectURLMock;
            global.URL.revokeObjectURL = revokeObjectURLMock;
            var originalCreateElement = document.createElement.bind(document);
            var linkMock = (0, jest_mock_extended_1.mock)({
                setAttribute: setAttributeMock,
                style: {},
                click: jest.fn()
            });
            var createElementMock = jest.spyOn(document, "createElement").mockImplementation(function (tagName) {
                if (tagName === "a") {
                    return linkMock;
                }
                return originalCreateElement(tagName);
            });
            jest.spyOn(document.body, "appendChild").mockImplementation(appendChildMock);
            jest.spyOn(document.body, "removeChild").mockImplementation(removeChildMock);
            return {
                createObjectURLMock: createObjectURLMock,
                setAttributeMock: setAttributeMock,
                appendChildMock: appendChildMock,
                removeChildMock: removeChildMock,
                createElementMock: createElementMock
            };
        }
        it("should create a download link and trigger click", function () {
            var _a = setup(), createObjectURLMock = _a.createObjectURLMock, setAttributeMock = _a.setAttributeMock, appendChildMock = _a.appendChildMock, removeChildMock = _a.removeChildMock, createElementMock = _a.createElementMock;
            var blob = new Blob(["test,data"], { type: "text/csv" });
            var filename = "myfile";
            var fakeUrl = "blob:http://example.com/fake-url";
            createObjectURLMock.mockReturnValue(fakeUrl);
            (0, domUtils_1.downloadCsv)(blob, filename);
            expect(createObjectURLMock).toHaveBeenCalledWith(blob);
            expect(createElementMock).toHaveBeenCalledWith("a");
            expect(setAttributeMock).toHaveBeenCalledWith("href", fakeUrl);
            expect(setAttributeMock).toHaveBeenCalledWith("download", "".concat(filename, ".csv"));
            expect(appendChildMock).toHaveBeenCalled();
            expect(removeChildMock).toHaveBeenCalled();
            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
        });
    });
});
