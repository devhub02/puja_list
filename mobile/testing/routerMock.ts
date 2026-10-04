/** Shared expo-router stand-in for screen tests (use via jest.mock('expo-router', () => require('../testing/routerMock').routerMock)). */
export const push = jest.fn();
export const navigate = jest.fn();
export const back = jest.fn();
export const replace = jest.fn();
export const canGoBack = jest.fn(() => true);

let params: Record<string, string | undefined> = {};
let pathname = '/';
export function setPathname(next: string) {
  pathname = next;
}
export function setParams(next: Record<string, string | undefined>) {
  params = next;
}

export function resetRouterMock() {
  [push, navigate, back, replace, canGoBack].forEach((fn) => fn.mockClear());
  params = {};
  pathname = '/';
}

export const routerMock = {
  /** The imperative router (used by Settings links, which need no navigation context to render). */
  router: { push, navigate, back, replace, canGoBack },
  useRouter: () => ({ push, navigate, back, replace, canGoBack }),
  useLocalSearchParams: () => params,
  usePathname: () => pathname,
};
