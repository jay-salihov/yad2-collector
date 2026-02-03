import { DEBOUNCE_MS } from "../shared/constants";

let lastProcessedUrl = "";
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function setupNavigationObserver(onNavigate: () => void): void {
  lastProcessedUrl = location.href;

  // Observe changes to the __NEXT_DATA__ script element
  const scriptEl = document.querySelector("script#__NEXT_DATA__");
  if (scriptEl) {
    const observer = new MutationObserver(() => {
      scheduleCheck(onNavigate);
    });
    observer.observe(scriptEl, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  // Also observe the document head for script element replacement
  // (Next.js may replace the entire script element on navigation)
  const headObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (
          node instanceof HTMLScriptElement &&
          node.id === "__NEXT_DATA__"
        ) {
          scheduleCheck(onNavigate);
          return;
        }
      }
    }
  });
  headObserver.observe(document.head ?? document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function scheduleCheck(onNavigate: () => void): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const currentUrl = location.href;
    if (currentUrl !== lastProcessedUrl) {
      lastProcessedUrl = currentUrl;
      onNavigate();
    }
  }, DEBOUNCE_MS);
}
