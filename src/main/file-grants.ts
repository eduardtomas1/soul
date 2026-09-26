import { resolve } from "node:path";

export interface FileGrants {
  readonly grant: (filePath: string) => string;
  readonly require: (filePath: string) => string;
}

export function createFileGrants(): FileGrants {
  const granted = new Set<string>();
  return {
    grant(filePath) {
      const resolved = resolve(filePath);
      granted.add(resolved);
      return resolved;
    },
    require(filePath) {
      const resolved = resolve(filePath);
      if (!granted.has(resolved)) throw new Error("Choose the file again.");
      return resolved;
    },
  };
}
