import { describe, it, expect } from "vitest";
import {
  findFeedQuery,
  findItemQuery,
  type NextDataQueries,
  type NextDataQuery,
} from "../../src/content/extractor";

function makeQuery(
  queryKey: unknown[],
  data: Record<string, unknown> = {},
): NextDataQuery {
  return {
    queryKey,
    state: { data },
  };
}

function makeQueries(...queries: NextDataQuery[]): NextDataQueries {
  return { queries };
}

describe("findFeedQuery", () => {
  it("finds query with queryKey[0] === 'feed'", () => {
    const feedData = { private: [], commercial: [] };
    const data = makeQueries(
      makeQuery(["other"]),
      makeQuery(["feed", "cars"], feedData),
    );
    const result = findFeedQuery(data);
    expect(result).toEqual(feedData);
  });

  it("returns null when no feed query exists", () => {
    const data = makeQueries(
      makeQuery(["item"]),
      makeQuery(["something"]),
    );
    expect(findFeedQuery(data)).toBeNull();
  });

  it("returns null for empty queries", () => {
    expect(findFeedQuery(makeQueries())).toBeNull();
  });

  it("returns first feed query when multiple exist", () => {
    const firstFeed = { first: true };
    const secondFeed = { second: true };
    const data = makeQueries(
      makeQuery(["feed", "cars"], firstFeed),
      makeQuery(["feed", "trucks"], secondFeed),
    );
    expect(findFeedQuery(data)).toEqual(firstFeed);
  });
});

describe("findItemQuery", () => {
  it("finds query with 'item' in queryKey", () => {
    const itemData = { token: "abc" };
    const data = makeQueries(
      makeQuery(["feed"]),
      makeQuery(["item", "abc123"], itemData),
    );
    const result = findItemQuery(data);
    expect(result).toEqual(itemData);
  });

  it("finds query with 'light' in queryKey", () => {
    const lightData = { token: "def" };
    const data = makeQueries(
      makeQuery(["feed"]),
      makeQuery(["light", "def456"], lightData),
    );
    expect(findItemQuery(data)).toEqual(lightData);
  });

  it("returns null when no item/light query exists", () => {
    const data = makeQueries(
      makeQuery(["feed"]),
      makeQuery(["other"]),
    );
    expect(findItemQuery(data)).toBeNull();
  });

  it("returns null for empty queries", () => {
    expect(findItemQuery(makeQueries())).toBeNull();
  });

  it("matches 'item' or 'light' at any position in queryKey", () => {
    const itemData = { nested: true };
    const data = makeQueries(
      makeQuery(["prefix", "item", "suffix"], itemData),
    );
    expect(findItemQuery(data)).toEqual(itemData);
  });
});
