/** `value`, which the caller knows is there. throws at the lookup, where a `!` would hand a null on to fail somewhere else. */
export function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("A value the code relies on is missing");

  return value;
}
