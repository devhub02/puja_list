/** Shared expo-router stand-in for screen tests (use via jest.mock('expo-router', () => require('../testing/routerMock').routerMock)). */
export const push = jest.fn();
export const navigate = jest.fn();
export const back = jest.fn();
export const replace = jest.fn();
export const canGoBack = jest.fn(() => true);

let params: Record<string, string | undefined> = {};
export function setParams(next: Record<string, string | undefined>) {
  params = next;
}

export function resetRouterMock() {
  [push, navigate, back, replace, canGoBack].forEach((fn) => fn.mockClear());
  params = {};
}

export const routerMock = {
  useRouter: () => ({ push, navigate, back, replace, canGoBack }),
  useLocalSearchParams: () => params,
};
