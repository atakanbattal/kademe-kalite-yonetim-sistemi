import React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef(({ className, children, hideCloseButton = false, overlayClassName, onPointerDownOutside, onFocusOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Temel modal stilleri
        "fixed z-50 grid gap-3 sm:gap-4 border bg-background shadow-lg duration-200",
        // Genişlik - varsayılan max-w-lg, bileşen seviyesinde override edilebilir (tailwind-merge sayesinde)
        "w-[calc(100%-1rem)] sm:w-auto sm:max-w-lg",
        // Padding
        "p-4 sm:p-6",
        // Pozisyonlama - merkez (fullscreen için className ile override)
        "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
        // Rounded
        "rounded-lg",
        // Maksimum yükseklik
        "max-h-[calc(100vh-2rem)] sm:max-h-[90vh]",
        // Overflow
        "overflow-hidden",
        // Animasyonlar
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      onPointerDownOutside={(event) => {
        const target = event.detail?.originalEvent?.target;
        if (target instanceof Element && target.closest("[data-kdm-combobox-content]")) {
          event.preventDefault();
        }
        onPointerDownOutside?.(event);
      }}
      onFocusOutside={(event) => {
        const related = event.detail?.originalEvent?.relatedTarget;
        if (related instanceof Element && related.closest("[data-kdm-combobox-content]")) {
          event.preventDefault();
        }
        onFocusOutside?.(event);
      }}
      {...props}
    >
      <DialogPrimitive.Description className="sr-only">
        Kademe Kalite Yönetim Sistemi iletişim penceresi
      </DialogPrimitive.Description>
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none touch-manipulation z-10">
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="sr-only">Kapat</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col space-y-1 sm:space-y-1.5 text-center sm:text-left pr-8", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2", className)}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base sm:text-lg font-semibold leading-tight sm:leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs sm:text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}