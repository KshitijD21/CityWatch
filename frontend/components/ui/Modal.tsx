"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  showClose?: boolean;
}

export function Modal({
  open,
  onClose,
  children,
  className,
  showClose = true,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current && onClose) onClose();
      }}
    >
      <div
        className={cn(
          "relative w-full max-w-md rounded-xl bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200",
          className
        )}
      >
        {showClose && onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
