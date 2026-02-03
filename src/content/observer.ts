import { DEBOUNCE_MS } from "../shared/constants";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function setupNavigationObserver(onNavigate: () => void): void {
  // Observe changes to the __NEXT_DATA__ script element
  const scriptEl = document.querySelector("script#__NEXT_DATA__");
  if (scriptEl) {
    const observer = new MutationObserver(() => {
      scheduleProcess(onNavigate);
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
          scheduleProcess(onNavigate);
          return;
        }
      }
    }
  });
  headObserver.observe(document.head ?? document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Detect SPA navigation via History API (Next.js uses pushState/replaceState)
  let lastUrl = location.href;

  const checkUrlChange = (): void => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      scheduleProcess(onNavigate);
    }
  };

  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    origPushState(...args);
    checkUrlChange();
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    origReplaceState(...args);
    checkUrlChange();
  };

  // Back/forward navigation
  window.addEventListener("popstate", checkUrlChange);
}

function scheduleProcess(onNavigate: () => void): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    onNavigate();
  }, DEBOUNCE_MS);
}
