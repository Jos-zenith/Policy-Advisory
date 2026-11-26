"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Side sheet on desktop, bottom sheet on phones (CLAUDE.md §13.4).
 * `full` makes it full-screen on phones (booking drawer).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  width = "md:max-w-[520px]",
  full = false,
  headerExtra,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  width?: string;
  full?: boolean;
  headerExtra?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="nf-overlay fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-white shadow-[var(--shadow-float)] focus:outline-none",
            full ? "inset-0 nf-sheet-bottom" : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-3xl nf-sheet-bottom",
            "md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:max-h-none md:w-full md:rounded-none md:rounded-l-3xl md:nf-sheet-right",
            width,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 md:px-7 md:py-5">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-xl font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">Panel</Dialog.Description>
              )}
            </div>
            <div className="flex items-center gap-2">
              {headerExtra}
              <Dialog.Close className="rounded-full p-2 text-muted hover:bg-bg-alt" aria-label="Close">
                <X className="size-5" />
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-7">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
