export interface NextDataQueries {
  queries: NextDataQuery[];
}

export interface NextDataQuery {
  queryKey: unknown[];
  state: {
    data: Record<string, unknown>;
  };
}

export function extractNextData(): NextDataQueries | null {
  const script = document.querySelector<HTMLScriptElement>(
    "script#__NEXT_DATA__",
  );
  if (!script?.textContent) {
    console.debug("[yad2-collector] No __NEXT_DATA__ script tag found");
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(script.textContent);
  } catch (e) {
    console.warn("[yad2-collector] Failed to parse __NEXT_DATA__ JSON:", e);
    return null;
  }

  const queries = getNestedValue(
    parsed,
    "props",
    "pageProps",
    "dehydratedState",
    "queries",
  );

  if (!Array.isArray(queries)) {
    console.debug(
      "[yad2-collector] No dehydratedState.queries found in __NEXT_DATA__",
    );
    return null;
  }

  return { queries: queries as NextDataQuery[] };
}

export function findFeedQuery(
  data: NextDataQueries,
): Record<string, unknown> | null {
  for (const q of data.queries) {
    const key = q.queryKey;
    if (Array.isArray(key) && key[0] === "feed") {
      return (q.state?.data as Record<string, unknown>) ?? null;
    }
  }
  return null;
}

export function findItemQuery(
  data: NextDataQueries,
): Record<string, unknown> | null {
  for (const q of data.queries) {
    const key = q.queryKey;
    if (Array.isArray(key) && key.some((k) => k === "item" || k === "light")) {
      return (q.state?.data as Record<string, unknown>) ?? null;
    }
  }
  return null;
}

/**
 * Extract queries from a /_next/data/ fetch response.
 * The response format is { pageProps: { dehydratedState: { queries: [...] } } }
 * (one level shallower than __NEXT_DATA__ which wraps this under "props").
 */
export function extractFromFetchResponse(payload: unknown): NextDataQueries | null {
  const queries = getNestedValue(
    payload,
    "pageProps",
    "dehydratedState",
    "queries",
  );

  if (!Array.isArray(queries)) {
    return null;
  }

  return { queries: queries as NextDataQuery[] };
}

function getNestedValue(obj: unknown, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
