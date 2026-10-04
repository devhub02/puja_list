export function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function parseOptionalJson<T>(value: string | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : (JSON.parse(value) as T);
}
