"use client";

import { useEffect, useState } from "react";
import { FormattedNumber } from "react-intl";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Sparks } from "iconoir-react";

interface PaymentSuccessAnimationProps {
  show: boolean;
  amount: string;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
}

export function PaymentSuccessAnimation({ show, amount, onComplete }: PaymentSuccessAnimationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (show) {
      // Generate particles for the celebration effect
      const colors = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444"];
      const newParticles: Particle[] = [];

      for (let i = 0; i < 20; i++) {
        newParticles.push({
          id: i,
          x: 50 + (Math.random() - 0.5) * 40, // percentage from center
          y: 50 + (Math.random() - 0.5) * 40, // percentage from center
          size: 3 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          duration: 1.5 + Math.random() * 1,
          delay: Math.random() * 0.5
        });
      }

      setParticles(newParticles);

      // Complete animation after 6 seconds
      const timer = setTimeout(() => {
        onComplete?.();
      }, 6000);

      return () => {
        clearTimeout(timer);
        setParticles([]);
      };
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={onComplete}
        >
          {/* Particles */}
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full"
              style={{
                left: `calc(${particle.x}% - ${particle.size / 2}px)`,
                top: `calc(${particle.y}% - ${particle.size / 2}px)`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                backgroundColor: particle.color
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                x: [0, (Math.random() - 0.5) * 200],
                y: [0, (Math.random() - 0.5) * 200],
                rotate: [0, 360]
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: "easeOut"
              }}
            />
          ))}

          {/* Main animation container */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative flex flex-col items-center"
          >
            {/* Glow effect */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.2, 1], opacity: [0, 0.3, 0] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="absolute inset-0 rounded-full bg-green-500 blur-xl"
            />

            {/* Success icon with pulse */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", damping: 15, stiffness: 200 }}
              className="relative mb-6"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                className="rounded-full bg-green-500 p-4 text-white shadow-lg shadow-green-500/30"
              >
                <CheckCircle className="h-16 w-16" strokeWidth={1.5} />
              </motion.div>

              {/* Sparkle effects around the icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, 180] }}
                transition={{ delay: 0.5, duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                className="absolute -right-2 -top-2"
              >
                <Sparks className="h-6 w-6 text-yellow-400" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0], rotate: [0, -180] }}
                transition={{ delay: 1, duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                className="absolute -bottom-2 -left-2"
              >
                <Sparks className="h-4 w-4 text-blue-400" />
              </motion.div>
            </motion.div>

            {/* Success message */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} className="text-center">
              <motion.h2 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mb-2 text-3xl font-bold text-foreground">
                Payment Successful!
              </motion.h2>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8, type: "spring", damping: 20 }}
                className="mb-4 flex items-center justify-center"
              >
                <div className="flex items-center rounded-lg border border-green-500/20 bg-green-500/10 px-6 py-3">
                  <span className="text-2xl font-bold text-green-500">
                    <FormattedNumber value={parseFloat(amount)} style="currency" currency="USD" />
                  </span>
                  <span className="ml-2 text-lg text-muted-foreground">added to your account</span>
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.5 }}
                className="max-w-md text-muted-foreground"
              >
                Your account has been successfully credited. You can now deploy applications on the Akash Network!
              </motion.p>
            </motion.div>

            {/* Ripple effect */}
            <motion.div
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: [0, 3], opacity: [0.5, 0] }}
              transition={{ delay: 0.3, duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border-2 border-green-500"
            />

            <motion.div
              initial={{ scale: 0, opacity: 0.3 }}
              animate={{ scale: [0, 4], opacity: [0.3, 0] }}
              transition={{ delay: 0.6, duration: 1.5, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-green-500"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
