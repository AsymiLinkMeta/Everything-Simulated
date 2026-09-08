/** Accept both direct payloads and leftover `{ data: ... }` wrappers from older callers. */
export function unwrap<T extends object>(input: T | { data: T }): T {
  if (input && typeof input === "object" && "data" in input) {
    const inner = (input as { data: T }).data;
    if (inner && typeof inner === "object") return inner;
  }
  return input as T;
}
