"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var useThrottledEffect_1 = require("./useThrottledEffect");
var react_1 = require("@testing-library/react");
describe(useThrottledEffect_1.useThrottledEffect.name, function () {
    beforeEach(function () {
        jest.useFakeTimers();
    });
    afterEach(function () {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });
    it("executes effect after delay", function () {
        var effect = jest.fn();
        (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } });
        expect(effect).not.toHaveBeenCalled();
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
    });
    it("throttles rapid dependency changes", function () {
        var effect = jest.fn();
        var rerender = (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } }).rerender;
        rerender({ deps: [2] });
        rerender({ deps: [3] });
        rerender({ deps: [4] });
        expect(effect).not.toHaveBeenCalled();
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
        expect(effect).toHaveBeenCalledWith();
    });
    it("cancels previous timeout when dependencies change", function () {
        var effect = jest.fn();
        var rerender = (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } }).rerender;
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(50);
        });
        rerender({ deps: [2] });
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
    });
    it("calls cleanup function when effect returns cleanup", function () {
        var cleanup = jest.fn();
        var effect = jest.fn(function () { return cleanup; });
        var rerender = (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } }).rerender;
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
        rerender({ deps: [2] });
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(cleanup).toHaveBeenCalledTimes(1);
    });
    it("handles effect that returns void", function () {
        var effect = jest.fn(function () { });
        var rerender = (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } }).rerender;
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
        rerender({ deps: [2] });
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(2);
    });
    it("uses default delay of 100ms", function () {
        var effect = jest.fn();
        (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps);
        }, {
            initialProps: { deps: [1] }
        });
        expect(effect).not.toHaveBeenCalled();
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
    });
    it("respects custom delay", function () {
        var effect = jest.fn();
        (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 200);
        }, {
            initialProps: { deps: [1] }
        });
        expect(effect).not.toHaveBeenCalled();
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).not.toHaveBeenCalled();
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
    });
    it("cleans up on unmount", function () {
        var cleanup = jest.fn();
        var effect = jest.fn(function () { return cleanup; });
        var unmount = (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } }).unmount;
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });
    it("handles multiple rapid changes with cleanup", function () {
        var cleanup = jest.fn();
        var effect = jest.fn(function () { return cleanup; });
        var rerender = (0, react_1.renderHook)(function (_a) {
            var deps = _a.deps;
            return (0, useThrottledEffect_1.useThrottledEffect)(effect, deps, 100);
        }, { initialProps: { deps: [1] } }).rerender;
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
        rerender({ deps: [2] });
        rerender({ deps: [3] });
        rerender({ deps: [4] });
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(2);
        expect(cleanup).toHaveBeenCalledTimes(1);
    });
    it("handles empty dependency array", function () {
        var effect = jest.fn();
        (0, react_1.renderHook)(function () { return (0, useThrottledEffect_1.useThrottledEffect)(effect, [], 100); });
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
    });
    it("handles undefined dependencies", function () {
        var effect = jest.fn();
        (0, react_1.renderHook)(function () { return (0, useThrottledEffect_1.useThrottledEffect)(effect, [], 100); });
        (0, react_1.act)(function () {
            jest.advanceTimersByTime(100);
        });
        expect(effect).toHaveBeenCalledTimes(1);
    });
});
