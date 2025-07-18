"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
}

export function ConfettiAnimation() {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    // Generate confetti pieces
    const pieces: ConfettiPiece[] = [];
    const colors = ["#FF3B4E", "#FFD700", "#7FFF00", "#00BFFF", "#FF69B4", "#9370DB"];

    for (let i = 0; i < 100; i++) {
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

    // Clean up
    return () => {
      setConfetti([]);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {confetti.map(piece => (
        <motion.div
          key={piece.id}
          className="absolute"
          initial={{
            x: `${piece.x}vw`,
            y: `${piece.y}vh`,
            rotate: piece.rotation,
            scale: piece.scale
          }}
          animate={{
            y: "120vh",
            rotate: piece.rotation + Math.random() * 720 - 360
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            ease: [0.1, 0.25, 0.3, 1]
          }}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          <div
            className="h-3 w-3"
            style={{
              backgroundColor: piece.color,
              borderRadius: Math.random() > 0.5 ? "50%" : "0",
              transform: `rotate(${Math.random() * 360}deg)`
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}
