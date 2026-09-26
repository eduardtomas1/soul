export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function foldedIndex(text: string, needle: string): { start: number; end: number } | null {
  const target = foldText(needle);
  if (target.length === 0) return null;
  const folded: string[] = [];
  const origins: number[] = [];
  Array.from(text).reduce((offset, character) => {
    for (const piece of foldText(character)) {
      folded.push(piece);
      origins.push(offset);
    }
    return offset + character.length;
  }, 0);
  const at = folded.join("").indexOf(target);
  if (at < 0) return null;
  const lastOrigin = origins[at + target.length - 1] ?? text.length;
  const lastCharacter = Array.from(text.slice(lastOrigin))[0] ?? "";
  return { start: origins[at] ?? 0, end: lastOrigin + lastCharacter.length };
}
