"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWindowSize = useWindowSize;
var react_1 = require("react");
// Hook
function useWindowSize() {
    // Initialize state with undefined width/height so server and client renders match
    // Learn more here: https://joshwcomeau.com/react/the-perils-of-rehydration/
    var _a = (0, react_1.useState)({
        width: undefined,
        height: undefined
    }), windowSize = _a[0], setWindowSize = _a[1];
    (0, react_1.useEffect)(function () {
        // Handler to call on window resize
        function handleResize() {
            // Set window width/height to state
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        }
        // Add event listener
        window.addEventListener("resize", handleResize);
        // Call handler right away so state gets updated with initial window size
        handleResize();
        // Remove event listener on cleanup
        return function () { return window.removeEventListener("resize", handleResize); };
    }, []); // Empty array ensures that effect is only run on mount
    return windowSize;
}
