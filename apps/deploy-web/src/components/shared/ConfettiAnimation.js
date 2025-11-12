"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfettiAnimation = ConfettiAnimation;
var react_1 = require("react");
var framer_motion_1 = require("framer-motion");
function ConfettiAnimation() {
    var _a = (0, react_1.useState)([]), confetti = _a[0], setConfetti = _a[1];
    (0, react_1.useEffect)(function () {
        var pieces = [];
        var colors = ["#FF3B4E", "#FFD700", "#7FFF00", "#00BFFF", "#FF69B4", "#9370DB"];
        for (var i = 0; i < 100; i++) {
            pieces.push({
                id: i,
                x: Math.random() * 100, // percentage across screen
                y: -20 - Math.random() * 10, // start above the viewport
                rotation: Math.random() * 360,
                scale: 0.5 + Math.random() * 1.5,
                color: colors[Math.floor(Math.random() * colors.length)]
            });
        }
        setConfetti(pieces);
        return function () {
            setConfetti([]);
        };
    }, []);
    return (<div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {confetti.map(function (piece) { return (<framer_motion_1.motion.div key={piece.id} className="absolute" initial={{
                x: "".concat(piece.x, "vw"),
                y: "".concat(piece.y, "vh"),
                rotate: piece.rotation,
                scale: piece.scale
            }} animate={{
                y: "120vh",
                rotate: piece.rotation + Math.random() * 720 - 360
            }} transition={{
                duration: 4 + Math.random() * 4,
                ease: [0.1, 0.25, 0.3, 1]
            }} style={{ originX: 0.5, originY: 0.5 }}>
          <div className="h-3 w-3" style={{
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "0",
                transform: "rotate(".concat(Math.random() * 360, "deg)")
            }}/>
        </framer_motion_1.motion.div>); })}
    </div>);
}
