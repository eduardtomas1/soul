import { useState, type ReactNode } from "react";
import type { ColorToken } from "@shared/contracts/common";
import type { IconKey } from "@shared/icons";
import { IconBadge } from "./glyph";
import { ColorPicker, IconPicker } from "./pickers";
import { Field } from "./primitives";

export function IconAndColor({ icon, color, onIcon, onColor, children }: { icon: string; color: ColorToken; onIcon: (icon: IconKey) => void; onColor: (color: ColorToken) => void; children: ReactNode }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <div className="flex items-start gap-4">
        <button type="button" aria-label="Choose icon" onClick={() => setPicking((value) => !value)} className="rounded-[6px]">
          <IconBadge name={icon} tone={color} size={40} />
        </button>
        <div className="flex flex-1 flex-col gap-3">
          {children}
          <Field label="Colour" group><ColorPicker value={color} onChange={onColor} /></Field>
        </div>
      </div>
      {picking && <div className="card p-3"><IconPicker value={icon} tone={color} onChange={(next) => { onIcon(next); setPicking(false); }} /></div>}
    </>
  );
}
