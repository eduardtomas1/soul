export function isRendererUrl(url: string, rendererUrl: string, devServer: boolean): boolean {
  try {
    const target = new URL(url);
    const expected = new URL(rendererUrl);
    if (devServer) return target.origin === expected.origin;
    return target.protocol === expected.protocol && target.host === expected.host && target.pathname === expected.pathname;
  } catch {
    return false;
  }
}
