import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ComponentProps, CSSProperties, HTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import type { ColorToken } from "@shared/contracts/common";

export { Segmented, Tabs } from "./tabs";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: "sm" | "md" | "lg";
  readonly icon?: ReactNode;
  readonly loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-text border border-accent hover:bg-accent-hover hover:border-accent-hover disabled:opacity-40",
  secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2 hover:border-faint disabled:opacity-50",
  ghost: "text-muted border border-transparent hover:text-text hover:bg-surface-2 disabled:opacity-40",
  danger: "bg-surface text-danger border border-border-strong hover:bg-danger/8 hover:border-danger/40 disabled:opacity-50",
};

const buttonSizes = {
  sm: "h-8 px-3 text-[12.5px] gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-10 px-4.5 text-[13.5px] gap-2",
};

export function Button({ variant = "secondary", size = "md", icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center rounded-[7px] font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:active:translate-y-0",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" /> : icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly size?: "sm" | "md";
  readonly active?: boolean;
}

export function IconButton({ label, size = "md", active, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex items-center justify-center rounded-[7px] text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        active && "bg-surface-2 text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, tone, style, ...rest }: { className?: string; children: ReactNode; tone?: ColorToken; style?: CSSProperties } & Omit<HTMLAttributes<HTMLDivElement>, "style">) {
  return (
    <div className={clsx("card", tone && `tone-${tone}`, className)} style={style} {...rest}>
      {children}
    </div>
  );
}

export function Panel({ title, meta, actions, icon, children, className, bodyClassName }: { title?: ReactNode; meta?: ReactNode; actions?: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={clsx("card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex h-[52px] items-center justify-between gap-3 border-b border-border px-5">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="flex shrink-0 text-muted">{icon}</span>}
            {title && <h2 className="truncate text-[13.5px] font-semibold">{title}</h2>}
            {meta && <span className="truncate text-[12px] text-muted">{meta}</span>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={clsx("overflow-x-auto", bodyClassName)}>{children}</div>
    </section>
  );
}

const METRIC_COLUMNS: Readonly<Record<number, string>> = {
  2: "grid-cols-2",
  3: "grid-cols-1 @min-[500px]:grid-cols-3",
  4: "grid-cols-2 @min-[700px]:grid-cols-4",
};

export function Metrics({ items, className }: { items: ReadonlyArray<{ label: string; value: ReactNode; hint?: ReactNode }>; className?: string }) {
  return (
    <div className={clsx("@container card overflow-hidden", className)}>
      <div className={clsx("-mr-px -mb-px grid", METRIC_COLUMNS[items.length] ?? "grid-cols-[repeat(auto-fit,minmax(168px,1fr))]")}>
        {items.map((item) => (
          <div key={item.label} className="min-w-0 border-r border-b border-border px-5 py-4">
            <div className="label-caps truncate">{item.label}</div>
            <div className="mt-2 text-[21px] font-semibold leading-tight tracking-[-0.01em] whitespace-nowrap tabular-nums">{item.value}</div>
            {item.hint !== undefined && <div className="mt-0.5 text-[12px] text-muted tabular-nums">{item.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Columns({ children, main = false }: { children: ReactNode; main?: boolean }) {
  return <div className={clsx("columns no-enter grid items-start gap-6", main ? "min-[1180px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : "min-[1180px]:grid-cols-2")}>{children}</div>;
}

export function Stack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("stack flex min-w-0 flex-col gap-6", className)}>{children}</div>;
}

export function Field({ label, hint, children, className, group }: { label: string; hint?: string; children: ReactNode; className?: string; group?: boolean }) {
  const content = (
    <>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </>
  );
  if (group) {
    return <div role="group" aria-label={label} className={clsx("flex flex-col gap-2", className)}>{content}</div>;
  }
  return <label className={clsx("flex flex-col gap-2", className)}>{content}</label>;
}

export const inputClass = "h-9 w-full rounded-[7px] border border-border-strong bg-surface px-3 text-[13px] text-text placeholder:text-faint transition-[border-color,box-shadow] hover:border-faint focus:border-signal focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none";

export function TextInput({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(inputClass, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(inputClass, "h-auto min-h-[80px] resize-none py-2", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputClass, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_9px_center] bg-no-repeat pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (next: boolean) => void; label?: string; description?: string; disabled?: boolean }) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx("relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40", checked ? "bg-signal" : "bg-surface-3")}
    >
      <span className={clsx("absolute top-[2px] left-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-[var(--ease-out)]", checked ? "translate-x-[12px]" : "translate-x-0")} />
    </button>
  );
  if (!label) return control;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        {description && <div className="mt-0.5 text-[12px] text-muted">{description}</div>}
      </div>
      {control}
    </div>
  );
}

export function Pill({ children, tone, className }: { children: ReactNode; tone?: ColorToken; className?: string }) {
  return <span className={clsx("inline-flex h-5 items-center gap-1 rounded-[4px] border px-1.5 text-[11.5px] font-medium", tone ? `tone-${tone} border-[color-mix(in_oklab,var(--tone)_35%,transparent)] text-[var(--tone)]` : "border-border text-muted", className)}>{children}</span>;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-2 px-8 py-12 text-center", className)}>
      {icon && <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface-2 text-muted">{icon}</div>}
      <div className="text-[14px] font-semibold">{title}</div>
      {description && <div className="max-w-[46ch] text-[13px] text-muted">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="fade rounded-[7px] border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">{message}</div>;
}

export function Kbd({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return (
    <kbd className={clsx("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border px-1 font-sans text-[10.5px] font-medium", inverse ? "border-side-3 bg-side-2 text-side-muted" : "border-border-strong bg-surface text-muted")}>
      {children}
    </kbd>
  );
}

export function RowButton({ onClick, children, className }: { onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className={clsx("flex max-w-full min-w-0 items-center gap-2.5 text-left", className)}>
      {children}
    </button>
  );
}

export function Skeleton({ className, height }: { className?: string; height?: number }) {
  return <div className={clsx("skeleton", className)} style={height === undefined ? undefined : { height }} aria-hidden="true" />;
}
