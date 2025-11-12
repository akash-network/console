"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuccessAnimation = SuccessAnimation;
var react_1 = require("react");
var framer_motion_1 = require("framer-motion");
var lucide_react_1 = require("lucide-react");
var ConfettiAnimation_1 = require("./ConfettiAnimation");
function SuccessAnimation(_a) {
    var show = _a.show, onComplete = _a.onComplete;
    var _b = (0, react_1.useState)(false), showConfetti = _b[0], setShowConfetti = _b[1];
    (0, react_1.useEffect)(function () {
        if (show) {
            setShowConfetti(true);
            var timer_1 = setTimeout(function () {
                onComplete === null || onComplete === void 0 ? void 0 : onComplete();
            }, 3000); // Animation duration + some extra time
            return function () { return clearTimeout(timer_1); };
        }
    }, [show, onComplete]);
    return (<>
      {showConfetti && <ConfettiAnimation_1.ConfettiAnimation />}
      <framer_motion_1.AnimatePresence>
        {show && (<framer_motion_1.motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onAnimationComplete={function () {
                if (!show)
                    setShowConfetti(false);
            }}>
            <framer_motion_1.motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="flex flex-col items-center">
              <framer_motion_1.motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: "spring", damping: 15, stiffness: 200 }} className="relative">
                <framer_motion_1.motion.div initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 0.2 }} transition={{ delay: 0.3, duration: 0.8 }} className="absolute inset-0 rounded-full bg-primary blur-xl"/>
                <framer_motion_1.motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring", damping: 10, stiffness: 100 }} className="relative rounded-full bg-primary p-4 text-white">
                  <lucide_react_1.CheckCircle className="h-16 w-16" strokeWidth={1.5}/>
                </framer_motion_1.motion.div>
              </framer_motion_1.motion.div>

              <framer_motion_1.motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }} className="mt-6 text-2xl font-bold text-foreground">
                Onboarding Complete!
              </framer_motion_1.motion.h2>

              <framer_motion_1.motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.5 }} className="mt-2 max-w-md text-center text-muted-foreground">
                Welcome to Akash Network. Your free trial is now active.
              </framer_motion_1.motion.p>
            </framer_motion_1.motion.div>
          </framer_motion_1.motion.div>)}
      </framer_motion_1.AnimatePresence>
    </>);
}
