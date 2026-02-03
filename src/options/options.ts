import type { CollectionStats } from "../background/db";
import type { ClearDatabaseMessage, ExportCsvMessage } from "../shared/messages";

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
  $("#clear-db-btn").addEventListener("click", openConfirmDialog);
  $("#dialog-export").addEventListener("click", handleExport);
  $("#dialog-confirm").addEventListener("click", handleClear);
  $("#dialog-cancel").addEventListener("click", closeDialog);
}

async function loadStats(): Promise<CollectionStats | null> {
  try {
    const stats = (await browser.runtime.sendMessage({
      type: "GET_STATS",
    })) as CollectionStats;
    $("#stats-vehicles").textContent = String(stats.vehicles);
    $("#stats-realestate").textContent = String(stats.realestate);
    $("#stats-total").textContent = String(stats.total);
    $("#stats-price-changes").textContent = String(stats.priceChanges);
    return stats;
  } catch (error) {
    console.error("[yad2-collector] Failed to load stats:", error);
    return null;
  }
}

async function openConfirmDialog() {
  const stats = await loadStats();
  if (stats) {
    $("#dialog-total").textContent = String(stats.total);
  }
  $<HTMLDialogElement>("#confirm-dialog").showModal();
}

function closeDialog() {
  $<HTMLDialogElement>("#confirm-dialog").close();
}

function setDialogButtons(disabled: boolean) {
  $<HTMLButtonElement>("#dialog-export").disabled = disabled;
  $<HTMLButtonElement>("#dialog-confirm").disabled = disabled;
  $<HTMLButtonElement>("#dialog-cancel").disabled = disabled;
}

async function handleExport() {
  setDialogButtons(true);
  try {
    const message: ExportCsvMessage = {
      type: "EXPORT_CSV",
      payload: { category: "all" },
    };
    const response = (await browser.runtime.sendMessage(message)) as {
      ok: boolean;
      error?: string;
    };
    if (response?.error) {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error("[yad2-collector] Export failed:", error);
    alert(
      `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    setTimeout(() => setDialogButtons(false), 1000);
  }
}

async function handleClear() {
  setDialogButtons(true);
  try {
    const message: ClearDatabaseMessage = { type: "CLEAR_DATABASE" };
    const response = (await browser.runtime.sendMessage(message)) as {
      ok: boolean;
      error?: string;
    };
    if (!response?.ok) {
      throw new Error(response?.error ?? "Unknown error");
    }
    closeDialog();
    await loadStats();
  } catch (error) {
    console.error("[yad2-collector] Clear failed:", error);
    alert(
      `Clear failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    setDialogButtons(false);
  }
}
