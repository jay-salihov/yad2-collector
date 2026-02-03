type RawObject = Record<string, unknown>;

/** Walk nested keys safely, returning the raw value or undefined. */
export function get(obj: unknown, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as RawObject)[key];
  }
  return current;
}

/** Extract `.text` from a nested dict field (e.g. `{ id: 1, text: "foo" }`), or stringify scalars. */
export function getText(obj: unknown, key: string): string {
  const val = get(obj, key);
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    const text = (val as RawObject)["text"];
    return text !== null && text !== undefined ? String(text) : "";
  }
  return String(val);
}

/** Extract `.id` from a nested dict field, as a string. */
export function getId(obj: unknown, key: string): string {
  const val = get(obj, key);
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null) {
    const id = (val as RawObject)["id"];
    return id !== null && id !== undefined ? String(id) : "";
  }
  return "";
}

/** Walk nested keys and return the result as a string, or fallback. */
export function getString(obj: unknown, ...keys: string[]): string {
  const val = get(obj, ...keys);
  if (val === null || val === undefined) return "";
  return String(val);
}

/** Coerce a value to number or null. */
export function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}
