import { X } from "@phosphor-icons/react";
import { clsx } from "clsx";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "@/lib/escape";
import { useFocusTrap } from "@/lib/focus-trap";
import { Button, IconButton } from "./primitives";

interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly width?: "md" | "lg";
}

export function Sheet({ open, onClose, title, description, children, footer, width = "md" }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useFocusTrap(panel, open);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div ref={panel} className={clsx("slide-in-right relative flex h-full flex-col border-l border-border bg-surface shadow-[var(--shadow-lg)]", width === "lg" ? "w-[640px] max-w-[92vw]" : "w-[460px] max-w-[92vw]")}>
        <header className="flex items-start justify-between gap-4 border-b border-border px-7 pt-6 pb-5">
          <div>
            <h2 className="text-[15px] font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-1 text-[12.5px] text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} size="sm">
            <X size={16} />
          </IconButton>
        </header>
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-7 py-6">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-border bg-surface-2 px-7 py-4">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function Modal({ open, onClose, title, children, footer, width = 420, align = "center", headerExtra }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: number; align?: "center" | "top"; headerExtra?: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  useEscape(onClose, open);
  useFocusTrap(card, open);
  if (!open) return null;
  return createPortal(
    <div className={clsx("fixed inset-0 z-50 flex justify-center p-6", align === "top" ? "items-start pt-[10vh]" : "items-center")} role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="fade absolute inset-0 bg-black/35" onClick={onClose} />
      <div ref={card} className="scale-in card relative flex flex-col gap-5 p-6 shadow-[var(--shadow-lg)]" style={{ width, maxWidth: "92vw" }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {headerExtra}
        </div>
        <div className="flex flex-col gap-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 pt-1">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function SheetActions({ leading, onCancel, onSave, saving = false, saveLabel }: { leading?: ReactNode; onCancel: () => void; onSave: () => void; saving?: boolean; saveLabel: string }) {
  return (
    <>
      {leading && <div className="mr-auto">{leading}</div>}
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="primary" onClick={onSave} loading={saving}>{saveLabel}</Button>
    </>
  );
}

export function ConfirmDelete({ name, detail, onConfirm, onClose }: { name: string | null; detail: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      open={name !== null}
      onClose={onClose}
      title={`Delete ${name ?? ""}?`}
      footer={<><Button variant="ghost" onClick={onClose}>Keep it</Button><Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Delete</Button></>}
    >
      <p className="text-[13px] text-muted">{detail}</p>
    </Modal>
  );
}
