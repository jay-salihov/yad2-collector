import type { CollectionStats } from "../background/db";
import type { ClearDatabaseMessage, ExportCsvMessage } from "../shared/messages";

// --- DOM helper ---

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found for selector: ${selector}`);
  return el;
}

// --- Field & operator definitions ---

interface FieldDef {
  label: string;
  value: string;
  type: "numeric" | "string";
}

interface RowPreset {
  field: string;
  operator: string;
  value: string;
}

const NUMERIC_OPERATORS = ["is", "≤", "≥", "<", ">", "is specified"];
const STRING_OPERATORS = ["is", "is not", "is specified"];

const VEHICLE_FIELDS: FieldDef[] = [
  { label: "Price", value: "currentPrice", type: "numeric" },
  { label: "Ad Type", value: "adType", type: "string" },
  { label: "Manufacturer", value: "manufacturer", type: "string" },
  { label: "Model", value: "model", type: "string" },
  { label: "Year", value: "year", type: "numeric" },
  { label: "Engine Type", value: "engineType", type: "string" },
  { label: "Gear Box", value: "gearBox", type: "string" },
  { label: "Hand", value: "hand", type: "numeric" },
  { label: "Km", value: "km", type: "numeric" },
  { label: "Color", value: "color", type: "string" },
];

const REALESTATE_FIELDS: FieldDef[] = [
  { label: "Price", value: "currentPrice", type: "numeric" },
  { label: "Ad Type", value: "adType", type: "string" },
  { label: "Property Type", value: "propertyType", type: "string" },
  { label: "Rooms", value: "rooms", type: "numeric" },
  { label: "Square Meters", value: "squareMeters", type: "numeric" },
  { label: "Floor", value: "floor", type: "numeric" },
  { label: "Total Floors", value: "totalFloors", type: "numeric" },
  { label: "Condition", value: "condition", type: "string" },
  { label: "City", value: "city", type: "string" },
  { label: "Neighborhood", value: "neighborhood", type: "string" },
];

// --- Tab switching ---

function setupTabs() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.dataset["tab"];
      if (tabId) {
        $(`#tab-${tabId}`).classList.add("active");
      }
    });
  });
}

// --- Condition row creation ---

function getOperators(fieldType: "numeric" | "string"): string[] {
  return fieldType === "numeric" ? NUMERIC_OPERATORS : STRING_OPERATORS;
}

function populateOperatorSelect(
  operatorSelect: HTMLSelectElement,
  fieldType: "numeric" | "string",
  presetOperator?: string,
) {
  operatorSelect.innerHTML = "";
  for (const op of getOperators(fieldType)) {
    const option = document.createElement("option");
    option.value = op;
    option.textContent = op;
    operatorSelect.appendChild(option);
  }
  if (presetOperator) {
    operatorSelect.value = presetOperator;
  }
}

function updateValueVisibility(row: HTMLElement) {
  const operatorSelect = row.querySelector<HTMLSelectElement>(".operator-select");
  const valueInput = row.querySelector<HTMLInputElement>(".value-input");
  if (!operatorSelect || !valueInput) return;

  if (operatorSelect.value === "is specified") {
    valueInput.classList.add("hidden");
  } else {
    valueInput.classList.remove("hidden");
  }
}

function createConditionRow(fields: FieldDef[], preset?: RowPreset): HTMLDivElement {
  const template = $<HTMLTemplateElement>("#condition-row-template");
  const clone = template.content.cloneNode(true) as DocumentFragment;
  const row = clone.querySelector<HTMLDivElement>(".condition-row")!;

  const fieldSelect = row.querySelector<HTMLSelectElement>(".field-select")!;
  const operatorSelect = row.querySelector<HTMLSelectElement>(".operator-select")!;
  const valueInput = row.querySelector<HTMLInputElement>(".value-input")!;

  for (const field of fields) {
    const option = document.createElement("option");
    option.value = field.value;
    option.textContent = field.label;
    fieldSelect.appendChild(option);
  }

  if (preset?.field) {
    fieldSelect.value = preset.field;
  }

  const selectedField = fields.find((f) => f.value === fieldSelect.value);
  const fieldType = selectedField?.type ?? "string";
  populateOperatorSelect(operatorSelect, fieldType, preset?.operator);

  if (preset?.value !== undefined) {
    valueInput.value = preset.value;
  }

  updateValueVisibility(row);

  fieldSelect.addEventListener("change", () => {
    const newField = fields.find((f) => f.value === fieldSelect.value);
    const newType = newField?.type ?? "string";
    populateOperatorSelect(operatorSelect, newType);
    updateValueVisibility(row);
  });

  operatorSelect.addEventListener("change", () => {
    updateValueVisibility(row);
  });

  return row;
}

// --- Condition group creation ---

function createConditionGroup(fields: FieldDef[], presetRows?: RowPreset[]): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "condition-group";

  const rowsContainer = document.createElement("div");
  rowsContainer.className = "condition-rows";

  const rows = presetRows && presetRows.length > 0 ? presetRows : [undefined];
  for (const preset of rows) {
    rowsContainer.appendChild(createConditionRow(fields, preset));
  }

  group.appendChild(rowsContainer);

  const addBtn = document.createElement("button");
  addBtn.className = "add-row-btn";
  addBtn.textContent = "+ Add condition";
  addBtn.addEventListener("click", () => {
    rowsContainer.appendChild(createConditionRow(fields));
  });
  group.appendChild(addBtn);

  return group;
}

// --- Render groups into a container ---

function renderGroups(
  containerId: string,
  fields: FieldDef[],
  presetGroups: RowPreset[][],
) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  presetGroups.forEach((groupPresets, i) => {
    if (i > 0) {
      const sep = document.createElement("div");
      sep.className = "or-separator";
      sep.textContent = "or";
      container.appendChild(sep);
    }
    container.appendChild(createConditionGroup(fields, groupPresets));
  });
}

// --- Determine fields from container ID ---

function getFieldsForContainer(containerId: string): FieldDef[] {
  return containerId.startsWith("vehicle") ? VEHICLE_FIELDS : REALESTATE_FIELDS;
}

// --- Add Group button handlers ---

function setupAddGroupButtons() {
  document.querySelectorAll<HTMLButtonElement>(".add-group-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset["target"];
      if (!targetId) return;

      const container = document.getElementById(targetId);
      if (!container) return;

      const fields = getFieldsForContainer(targetId);

      if (container.children.length > 0) {
        const sep = document.createElement("div");
        sep.className = "or-separator";
        sep.textContent = "or";
        container.appendChild(sep);
      }

      container.appendChild(createConditionGroup(fields));
    });
  });
}

// --- Remove row delegation ---

function setupRemoveRowDelegation() {
  $("main").addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("remove-row-btn")) return;

    const row = target.closest(".condition-row");
    if (!row) return;

    const rowsContainer = row.closest(".condition-rows");
    const group = row.closest(".condition-group");
    if (!rowsContainer || !group) return;

    row.remove();

    if (rowsContainer.children.length === 0) {
      const rulesContainer = group.parentElement;
      if (!rulesContainer) return;

      const groupIndex = Array.from(rulesContainer.children).indexOf(group);

      // Remove adjacent OR separator
      if (groupIndex > 0) {
        const prev = rulesContainer.children[groupIndex - 1];
        if (prev?.classList.contains("or-separator")) {
          prev.remove();
        }
      } else if (rulesContainer.children.length > 1) {
        const next = rulesContainer.children[groupIndex + 1];
        if (next?.classList.contains("or-separator")) {
          next.remove();
        }
      }

      group.remove();
    }
  });
}

// --- Render sample data ---

function renderSampleData() {
  renderGroups("vehicle-scan-groups", VEHICLE_FIELDS, [
    [
      { field: "manufacturer", operator: "is", value: "" },
      { field: "currentPrice", operator: "≤", value: "60000" },
      { field: "currentPrice", operator: ">", value: "60000" },
    ],
    [{ field: "manufacturer", operator: "is", value: "Toyota" }],
  ]);

  renderGroups("vehicle-export-groups", VEHICLE_FIELDS, [
    [{ field: "currentPrice", operator: "is specified", value: "" }],
  ]);

  // Real estate tabs start empty
}

// --- Stats ---

async function loadStats(): Promise<CollectionStats | null> {
  try {
    const stats = (await browser.runtime.sendMessage({
      type: "GET_STATS",
    })) as CollectionStats;
    $("#stats-vehicles").textContent = String(stats.vehicles);
    $("#stats-realestate").textContent = String(stats.realestate);
    $("#stats-total").textContent = String(stats.total);
    $("#stats-price-changes").textContent = String(stats.priceChanges);
    $<HTMLButtonElement>("#clear-db-btn").disabled = stats.total === 0;

    $("#vehicle-scan-total").textContent = String(stats.vehicles);
    $("#vehicle-export-total").textContent = String(stats.vehicles);
    $("#realestate-scan-total").textContent = String(stats.realestate);
    $("#realestate-export-total").textContent = String(stats.realestate);

    return stats;
  } catch (error) {
    console.error("[yad2-collector] Failed to load stats:", error);
    return null;
  }
}

// --- Dialog handlers ---

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

function setupEventListeners() {
  $("#clear-db-btn").addEventListener("click", openConfirmDialog);
  $("#dialog-export").addEventListener("click", handleExport);
  $("#dialog-confirm").addEventListener("click", handleClear);
  $("#dialog-cancel").addEventListener("click", closeDialog);
}

// --- Init ---

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupAddGroupButtons();
  setupRemoveRowDelegation();
  renderSampleData();
  setupEventListeners();
  await loadStats();
});
