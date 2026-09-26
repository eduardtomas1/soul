import { useState } from "react";
import type { ColorToken } from "@shared/contracts/common";
import type { Category, CategoryInput } from "@shared/contracts/finances";
import { DEFAULT_CATEGORY_ICON } from "@shared/icons";
import { useMutation } from "@/lib/query";
import { Button, Field, InlineError, TextInput } from "@/components/primitives";
import { IconAndColor } from "@/components/icon-and-color";
import { Sheet, SheetActions } from "@/components/sheet";
import { KindSwitch } from "./fields";

export function CategoryEditor({ category, open, onClose, defaultKind }: { category: Category | null; open: boolean; onClose: () => void; defaultKind?: Category["kind"] }) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<Category["kind"]>(category?.kind ?? defaultKind ?? "expense");
  const [icon, setIcon] = useState<string>(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState<ColorToken>(category?.color ?? "slate");
  const [validation, setValidation] = useState<string | null>(null);
  const create = useMutation("finances.categories.create");
  const update = useMutation("finances.categories.update");
  const archive = useMutation("finances.categories.archive");
  const save = async () => {
    if (name.trim().length === 0) return setValidation("Give the category a name.");
    setValidation(null);
    const input: CategoryInput = { name: name.trim(), kind, icon, color };
    const saved = category ? await update.run({ id: category.id, input }) : await create.run(input);
    if (saved) onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={category ? "Edit category" : "New category"}
      footer={<SheetActions leading={category && <Button variant="ghost" onClick={() => void archive.run({ id: category.id, archived: category.archivedAt === null }).then(onClose)}>{category.archivedAt ? "Restore" : "Archive"}</Button>} onCancel={onClose} onSave={() => void save()} saving={create.pending || update.pending} saveLabel={category ? "Save" : "Create"} />}
    >
      <IconAndColor icon={icon} color={color} onIcon={setIcon} onColor={setColor}>
        <Field label="Name"><TextInput autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Groceries" /></Field>
      </IconAndColor>
      <Field label="Kind" group><KindSwitch value={kind} onChange={setKind} /></Field>
      <InlineError message={validation ?? create.error ?? update.error} />
    </Sheet>
  );
}
