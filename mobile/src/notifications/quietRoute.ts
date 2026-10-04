/** Whether the screen on top is one that must never be interrupted (the vidhi reader). */
let quiet = false;

export function setQuietRoute(pathname: string): void {
  quiet = /\/vidhi(\/|$|\?)/.test(pathname);
}

export function isQuietRoute(): boolean {
  return quiet;
}
