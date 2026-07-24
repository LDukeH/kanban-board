import { motion } from "motion/react";

interface AuthSidePanelProps {
  isRegister: boolean;
}

export default function AuthSidePanel({ isRegister }: AuthSidePanelProps) {
  return (
    <motion.div
      animate={{
        left: isRegister ? "50%" : "0%",
      }}
      transition={{
        type: "spring",
        stiffness: 70,
        damping: 22,
        mass: 1,
      }}
      className="absolute inset-y-0 w-1/2 z-10 overflow-hidden max-md:hidden"
    >
      <div className="relative h-full w-full">
        <img
          src="/side-image.png"
          alt="Kanban workspace illustration"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-8 left-8 right-8 text-white">
          <h2 className="text-2xl font-bold">Flow Board</h2>
          <p className="text-sm text-white/80 mt-1">
            Organize your projects visually
          </p>
        </div>
      </div>
    </motion.div>
  );
}
