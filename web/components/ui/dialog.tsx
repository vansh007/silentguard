"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

/** Lightweight modal (used for the figure lightbox). Esc / backdrop closes. */
export default function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/85 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.97, y: 8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[88vh] w-full max-w-4xl overflow-auto rounded-2xl border border-white/10 bg-panel/95 p-5 shadow-lift"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="text-sm font-semibold text-white">{title}</div>
              <button
                onClick={onClose}
                className="rounded-lg border border-hair px-2 py-1 text-[11px] text-muted transition hover:border-slate-500 hover:text-white"
              >
                esc ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
