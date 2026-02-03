import { describe, it, expect } from "vitest";
import {
  get,
  getText,
  getId,
  getString,
  toNumberOrNull,
} from "../../src/content/parsers/common";

describe("get", () => {
  it("walks deep nesting", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(get(obj, "a", "b", "c")).toBe(42);
  });

  it("returns undefined for null at any level", () => {
    const obj = { a: { b: null } };
    expect(get(obj, "a", "b", "c")).toBeUndefined();
  });

  it("returns undefined for missing keys", () => {
    const obj = { a: 1 };
    expect(get(obj, "b")).toBeUndefined();
    expect(get(obj, "a", "b")).toBeUndefined();
  });

  it("returns undefined for empty keys on non-object", () => {
    expect(get(42, "a")).toBeUndefined();
    expect(get(null, "a")).toBeUndefined();
    expect(get(undefined, "a")).toBeUndefined();
  });

  it("returns the root when no keys are provided", () => {
    const obj = { a: 1 };
    expect(get(obj)).toEqual({ a: 1 });
  });
});

describe("getText", () => {
  it("extracts .text from object field", () => {
    const obj = { color: { id: 1, text: "Red" } };
    expect(getText(obj, "color")).toBe("Red");
  });

  it("stringifies scalar values", () => {
    const obj = { count: 42 };
    expect(getText(obj, "count")).toBe("42");
  });

  it("returns empty string for null/undefined", () => {
    expect(getText({ a: null }, "a")).toBe("");
    expect(getText({}, "missing")).toBe("");
  });

  it("returns empty string when .text is missing from object", () => {
    const obj = { color: { id: 1 } };
    expect(getText(obj, "color")).toBe("");
  });
});

describe("getId", () => {
  it("extracts .id from object field", () => {
    const obj = { manufacturer: { id: 5, text: "Toyota" } };
    expect(getId(obj, "manufacturer")).toBe("5");
  });

  it("returns empty string for non-object", () => {
    expect(getId({ a: 42 }, "a")).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(getId({}, "missing")).toBe("");
    expect(getId({ a: null }, "a")).toBe("");
  });

  it("returns empty string when .id is missing", () => {
    const obj = { item: { text: "foo" } };
    expect(getId(obj, "item")).toBe("");
  });
});

describe("getString", () => {
  it("walks deep path and returns string", () => {
    const obj = { a: { b: { c: "hello" } } };
    expect(getString(obj, "a", "b", "c")).toBe("hello");
  });

  it("converts numbers to string", () => {
    const obj = { a: 42 };
    expect(getString(obj, "a")).toBe("42");
  });

  it("returns empty string for missing path", () => {
    expect(getString({}, "a", "b")).toBe("");
  });

  it("returns empty string for null values", () => {
    expect(getString({ a: null }, "a")).toBe("");
  });
});

describe("toNumberOrNull", () => {
  it("converts integers", () => {
    expect(toNumberOrNull(42)).toBe(42);
  });

  it("converts floats", () => {
    expect(toNumberOrNull(3.14)).toBe(3.14);
  });

  it("converts string numbers", () => {
    expect(toNumberOrNull("42")).toBe(42);
    expect(toNumberOrNull("3.14")).toBe(3.14);
  });

  it("returns null for empty string", () => {
    expect(toNumberOrNull("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(toNumberOrNull(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(toNumberOrNull(undefined)).toBeNull();
  });

  it("returns null for NaN-producing input", () => {
    expect(toNumberOrNull("abc")).toBeNull();
  });

  it("returns null for Infinity", () => {
    expect(toNumberOrNull(Infinity)).toBeNull();
    expect(toNumberOrNull(-Infinity)).toBeNull();
  });
});
