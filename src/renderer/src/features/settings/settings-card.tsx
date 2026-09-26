import type { ReactNode } from "react";

export function SettingsCard({ title, description, children }: { title: string; description?: string | undefined; children?: ReactNode }) {
  return (
    <section className="card">
      <header className="px-5 py-3.5">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 max-w-[72ch] text-[12.5px] text-muted">{description}</p>}
      </header>
      {children && <div className="flex flex-col gap-3 border-t border-border px-5 py-4">{children}</div>}
    </section>
  );
}
