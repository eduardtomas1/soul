import { clsx } from "clsx";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { MEDAL_LABELS } from "@shared/icons";
import { TOAST_DURATION, useToasts } from "@/lib/toasts";
import { MilestoneMark, medalSubjectLabel } from "./medal";

export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[60] flex flex-col items-end gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} role="status" className="slide-in-up pointer-events-auto relative flex min-w-[280px] max-w-[380px] items-center gap-3 overflow-hidden rounded-[10px] border border-border bg-surface px-3.5 py-3 shadow-[var(--shadow-lg)]">
          {toast.medal ? (
            <>
              <span className="pop"><MilestoneMark kind={toast.medal.kind} size={34} /></span>
              <div className="min-w-0 flex-1">
                <div className="label-caps">New milestone</div>
                <div className="truncate text-[13px] font-semibold">{MEDAL_LABELS[toast.medal.kind].title}{medalSubjectLabel(toast.medal) ? ` · ${medalSubjectLabel(toast.medal)}` : ""}</div>
                <div className="text-[12px] text-muted">{MEDAL_LABELS[toast.medal.kind].description}</div>
              </div>
            </>
          ) : (
            <>
              <span className={clsx("shrink-0", toast.tone === "danger" ? "text-danger" : toast.tone === "success" ? "text-success" : "text-muted")}>
                {toast.tone === "danger" ? <WarningCircle size={18} weight="fill" /> : toast.tone === "success" ? <CheckCircle size={18} weight="fill" /> : <Info size={18} weight="fill" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{toast.title}</div>
                {toast.description && <div className="text-[12.5px] text-muted">{toast.description}</div>}
              </div>
            </>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="shrink-0 text-faint hover:text-text">
            <X size={14} />
          </button>
          <span aria-hidden="true" className={clsx("toast-timer absolute bottom-0 left-0 h-[2px] w-full", toast.tone === "danger" ? "bg-danger" : toast.medal ? "bg-warning" : "bg-signal")} style={{ animationDuration: `${toast.medal ? TOAST_DURATION.medal : TOAST_DURATION.default}ms` }} />
        </div>
      ))}
    </div>
  );
}
