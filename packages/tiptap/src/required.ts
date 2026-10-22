/** Assert required schema members and structural children at the adapter boundary. */
export function required<T>(value: T | null | undefined): T {
  if (value == null)
    throw new Error("Missing required adapter schema member or child");
  return value;
}
