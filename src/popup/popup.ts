import { GetStatsMessage, ExportCsvMessage } from "../shared/messages";
import { CollectionStats } from "../background/db";

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found for selector: ${selector}`);
  return el;
}

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await loadStats();
});

function setupEventListeners() {
  $("#export-vehicles").addEventListener("click", () => handleExport("vehicles"));
  $("#export-realestate").addEventListener("click", () => handleExport("realestate"));
  $("#export-all").addEventListener("click", () => handleExport("all"));
  $("#open-options").addEventListener("click", (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });
}

async function loadStats() {
  try {
    const stats = await browser.runtime.sendMessage<GetStatsMessage, CollectionStats>({ type: "GET_STATS" });
    updateStatsUI(stats);
  } catch (error) {
    console.error("Failed to load stats:", error);
    showError("Failed to load stats.");
  }
}

function updateStatsUI(stats: CollectionStats) {
  $("#stats-vehicles").textContent = String(stats.vehicles);
  $("#stats-realestate").textContent = String(stats.realestate);
  $("#stats-total").textContent = String(stats.total);
  $("#stats-price-changes").textContent = String(stats.priceChanges);

  if (stats.lastCollectedAt) {
    $("#stats-last-collected").textContent = formatRelativeTime(stats.lastCollectedAt);
  } else {
    $("#stats-last-collected").textContent = "never";
  }
}

async function handleExport(category: "vehicles" | "realestate" | "all") {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".export button");
  buttons.forEach(b => b.disabled = true);

  try {
    const message: ExportCsvMessage = {
      type: "EXPORT_CSV",
      payload: { category },
    };
    const response = await browser.runtime.sendMessage(message);
    if (response && response.error) {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error(`Export failed for category: ${category}`, error);
    showError(`Export failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  } finally {
    // Re-enable buttons after a short delay to prevent rapid clicking
    setTimeout(() => {
      buttons.forEach(b => b.disabled = false);
    }, 1000);
  }
}

function showError(message: string) {
  // A simple way to show an error. Could be improved with a dedicated UI element.
  alert(message);
}

function formatRelativeTime(isoTimestamp: string): string {
  const now = new Date();
  const past = new Date(isoTimestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}