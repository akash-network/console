"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentMock = ComponentMock;
exports.MockComponents = MockComponents;
/**
 * Dump component that just renders children in React.Fragment
 */
function ComponentMock(props) {
    return <>{props.children}</>;
}
function MockComponents(components, overrides) {
    return Object.keys(components).reduce(function (all, name) {
        all[name] = (overrides === null || overrides === void 0 ? void 0 : overrides[name]) || jest.fn(ComponentMock);
        return all;
    }, {});
}
