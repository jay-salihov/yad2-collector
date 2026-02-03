import { openDB } from "./db";
import { setupMessageListener } from "./messages";

// Must register listener synchronously per MV3 rules
setupMessageListener();

// Warm up the DB connection (non-blocking)
openDB().catch((err) => {
  console.error("[yad2-collector] Failed to open DB:", err);
});

console.debug("[yad2-collector] Background service worker initialized");
