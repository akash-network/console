"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

import { ConfettiAnimation } from "./ConfettiAnimation";

interface SuccessAnimationProps {
  show: boolean;
  onComplete?: () => void;
}

export function SuccessAnimation({ show, onComplete }: SuccessAnimationProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        onComplete?.();
      }, 3000); // Animation duration + some extra time
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <>
      {showConfetti && <ConfettiAnimation />}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onAnimationComplete={() => {
              if (!show) setShowConfetti(false);
            }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="flex flex-col items-center"
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", damping: 15, stiffness: 200 }}
                className="relative"
              >
                <motion.div
                  initial={{ scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.2 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="absolute inset-0 rounded-full bg-primary blur-xl"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", damping: 10, stiffness: 100 }}
                  className="relative rounded-full bg-primary p-4 text-white"
                >
                  <CheckCircle className="h-16 w-16" strokeWidth={1.5} />
                </motion.div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="mt-6 text-2xl font-bold text-foreground"
              >
                Onboarding Complete!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-2 max-w-md text-center text-muted-foreground"
              >
                Welcome to Akash Network. Your free trial is now active.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
