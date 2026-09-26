import type { SoulDatabase } from "../../database/open";
import { newId, nowIso } from "../../database/ids";
import type { Category, CategoryInput } from "@shared/contracts/finances";
import { toCategory, type CategoryRow } from "./rows";

const DEFAULT_CATEGORIES: readonly CategoryInput[] = [
  { name: "Salary", kind: "income", icon: "euro-banknote", color: "mint" },
  { name: "Other income", kind: "income", icon: "coin", color: "lime" },
  { name: "Home", kind: "expense", icon: "house", color: "sand" },
  { name: "Groceries", kind: "expense", icon: "shopping-cart", color: "amber" },
  { name: "Eating out", kind: "expense", icon: "fork-and-knife-with-plate", color: "coral" },
  { name: "Transport", kind: "expense", icon: "bus", color: "sky" },
  { name: "Health", kind: "expense", icon: "anatomical-heart", color: "rose" },
  { name: "Subscriptions", kind: "expense", icon: "laptop", color: "iris" },
  { name: "Leisure", kind: "expense", icon: "party-popper", color: "plum" },
  { name: "Savings", kind: "expense", icon: "money-bag", color: "mint" },
  { name: "Other", kind: "expense", icon: "receipt", color: "slate" },
];

export interface CategoriesStore {
  readonly list: () => Category[];
  readonly create: (input: CategoryInput) => Category;
  readonly update: (id: string, input: CategoryInput) => Category;
  readonly setArchived: (id: string, archived: boolean) => Category;
  readonly remove: (id: string) => void;
  readonly ensureDefaults: () => void;
}

export function createCategoriesStore(database: SoulDatabase): CategoriesStore {
  const selectCategories = database.prepare<[], CategoryRow>("SELECT * FROM categories ORDER BY kind DESC, sort_order, name");
  const selectCategory = database.prepare<[string], CategoryRow>("SELECT * FROM categories WHERE id = ?");
  const countCategories = database.prepare<[], { count: number }>("SELECT COUNT(*) AS count FROM categories");
  const insertCategory = database.prepare<[string, string, string, string, string, number]>(
    "INSERT INTO categories (id, name, kind, icon, color, sort_order, archived_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
  );
  const updateCategory = database.prepare<[string, string, string, string, string]>(
    "UPDATE categories SET name = ?, kind = ?, icon = ?, color = ? WHERE id = ?",
  );
  const archiveCategory = database.prepare<[string | null, string]>("UPDATE categories SET archived_at = ? WHERE id = ?");
  const deleteCategory = database.prepare<[string]>("DELETE FROM categories WHERE id = ?");
  const maxCategorySort = database.prepare<[], { max: number | null }>("SELECT MAX(sort_order) AS max FROM categories");

  function requireCategory(id: string): Category {
    const row = selectCategory.get(id);
    if (!row) throw new Error("Category not found.");
    return toCategory(row);
  }

  return {
    list: () => selectCategories.all().map(toCategory),
    create(input: CategoryInput): Category {
      const id = newId();
      insertCategory.run(id, input.name, input.kind, input.icon, input.color, (maxCategorySort.get()?.max ?? -1) + 1);
      return requireCategory(id);
    },
    update(id: string, input: CategoryInput): Category {
      requireCategory(id);
      updateCategory.run(input.name, input.kind, input.icon, input.color, id);
      return requireCategory(id);
    },
    setArchived(id: string, archived: boolean): Category {
      archiveCategory.run(archived ? nowIso() : null, id);
      return requireCategory(id);
    },
    remove(id: string): void {
      deleteCategory.run(id);
    },
    ensureDefaults: database.transaction(() => {
      if ((countCategories.get()?.count ?? 0) > 0) return;
      DEFAULT_CATEGORIES.forEach((category, index) => {
        insertCategory.run(newId(), category.name, category.kind, category.icon, category.color, index);
      });
    }),
  };
}
