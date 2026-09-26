export function containsPattern(text: string): string {
  return `%${text.replace(/[%_\\]/gu, (match) => `\\${match}`)}%`;
}
