import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import AuthSidePanel from "./AuthSidePanel";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

export default function AuthLayout() {
  const [activeMode, setActiveMode] = useState<"login" | "register">("login");

  const isRegister = activeMode === "register";

  const switchMode = useCallback((target: "login" | "register") => {
    setActiveMode(target);
  }, []);

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-background">
      {/* Mobile view — stacked layout */}
      <div className="flex flex-col h-full w-full md:hidden">
        <div className="relative h-48 shrink-0 overflow-hidden">
          <img
            src="/side-image.png"
            alt="Kanban workspace illustration"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <h2 className="text-lg font-bold">Kanban Board</h2>
            <p className="text-xs text-white/80">
              Organize your projects visually
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeMode === "login" ? (
                <LoginForm onNavigate={switchMode} />
              ) : (
                <RegisterForm onNavigate={switchMode} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop view — animated split-screen */}
      <div className="hidden md:flex h-full w-full">
        <AuthSidePanel isRegister={isRegister} />

        <motion.div
          animate={{
            left: isRegister ? "0%" : "50%",
          }}
          transition={{
            type: "spring",
            stiffness: 70,
            damping: 22,
            mass: 1,
          }}
          className="absolute inset-y-0 w-1/2 overflow-y-auto"
        >
          <div className="flex min-h-full items-center justify-center py-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {activeMode === "login" ? (
                  <LoginForm onNavigate={switchMode} />
                ) : (
                  <RegisterForm onNavigate={switchMode} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
