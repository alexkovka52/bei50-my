"use client";

import { MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";
import { MOTION } from "@/lib/motion";

export function MainColumn({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="flex min-w-0 flex-1 flex-col gap-[22px] pt-6 pr-8 pb-8 pl-2"
        initial={{ y: MOTION.distance }}
        animate={{ y: 0 }}
        transition={{ duration: MOTION.surface / 1000, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
