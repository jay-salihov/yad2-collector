/**
 * MAIN-world script — runs in the page's JavaScript context (not the
 * extension's isolated world).  Injected at document_start so that
 * window.fetch is wrapped before any page code executes.
 *
 * Purpose: intercept fetch() responses from Next.js client-side data
 * endpoints (/_next/data/) and forward the JSON payload to the
 * isolated-world content script via window.postMessage.
 *
 * Next.js does NOT update the __NEXT_DATA__ script tag on SPA navigation;
 * it fetches fresh page data from /_next/data/<buildId>/… instead.
 * Without this interceptor the content script only ever sees the
 * server-rendered data from the initial page load.
 */

const MESSAGE_TYPE = "__yad2_collector_next_data__";

const originalFetch = window.fetch;

window.fetch = function (
  ...args: Parameters<typeof fetch>
): ReturnType<typeof fetch> {
  const result = originalFetch.apply(this, args);

  try {
    const input = args[0];
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input?.url ?? "");

    if (url.includes("/_next/data/")) {
      result
        .then((response) => {
          if (response.ok) {
            response
              .clone()
              .json()
              .then((data: unknown) => {
                window.postMessage({ type: MESSAGE_TYPE, payload: data }, "*");
              })
              .catch(() => {
                /* ignore JSON parse errors */
              });
          }
        })
        .catch(() => {
          /* ignore network errors */
        });
    }
  } catch {
    /* never break the page's fetch call */
  }

  return result;
};
