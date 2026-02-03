import { openDB } from "./db";
import { setupMessageListener } from "./messages";

async function init(): Promise<void> {
  await openDB();
  setupMessageListener();
  console.debug("[yad2-collector] Background service worker initialized");
}

init().catch((err) => {
  console.error("[yad2-collector] Failed to initialize:", err);
});
