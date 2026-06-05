const config = window.SITE_CONFIG || {};
const state = {};

const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function selectedList(id) {
  return Array.isArray(state[id]) ? state[id] : [];
}

function initState() {
  (config.fields || []).forEach((field) => {
    state[field.id] = field.type === "checklist" ? (field.default || []) : (field.default ?? "");
  });
}

function renderField(field) {
  const hint = field.hint ? `<span class="field-hint">${escapeHtml(field.hint)}</span>` : "";
  const value = state[field.id] ?? "";
  if (field.type === "select") {
    return `<label class="field"><span>${escapeHtml(field.label)}</span>${hint}<select data-field="${field.id}">${(field.options || []).map((item) => `<option value="${escapeHtml(item)}" ${item === value ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label>`;
  }
  if (field.type === "textarea") {
    return `<label class="field field-wide"><span>${escapeHtml(field.label)}</span>${hint}<textarea data-field="${field.id}" rows="${field.rows || 5}">${escapeHtml(value)}</textarea></label>`;
  }
  if (field.type === "color") {
    return `<label class="field"><span>${escapeHtml(field.label)}</span>${hint}<input type="color" data-field="${field.id}" value="${escapeHtml(value)}"></label>`;
  }
  if (field.type === "checklist") {
    return `<fieldset class="field field-wide"><legend>${escapeHtml(field.label)}</legend>${hint}<div class="check-grid">${(field.options || []).map((item) => {
      const checked = selectedList(field.id).includes(item) ? "checked" : "";
      return `<label><input type="checkbox" data-checkgroup="${field.id}" value="${escapeHtml(item)}" ${checked}> ${escapeHtml(item)}</label>`;
    }).join("")}</div></fieldset>`;
  }
  const inputType = field.type === "number" || field.type === "range" ? field.type : "text";
  const step = field.step ? ` step="${escapeHtml(field.step)}"` : "";
  const min = field.min !== undefined ? ` min="${escapeHtml(field.min)}"` : "";
  const max = field.max !== undefined ? ` max="${escapeHtml(field.max)}"` : "";
  return `<label class="field"><span>${escapeHtml(field.label)}</span>${hint}<input type="${inputType}" data-field="${field.id}" value="${escapeHtml(value)}"${step}${min}${max}></label>`;
}

function renderForm() {
  qs("#toolFields").innerHTML = (config.fields || []).map(renderField).join("");
}

function updateFromEvent(event) {
  const target = event.target;
  if (target.matches("[data-field]")) {
    state[target.dataset.field] = target.value;
    renderResult();
  }
  if (target.matches("[data-checkgroup]")) {
    const group = target.dataset.checkgroup;
    state[group] = qsa("[data-checkgroup]").filter((node) => node.dataset.checkgroup === group && node.checked).map((node) => node.value);
    renderResult();
  }
}

function inputs() {
  const data = {};
  (config.fields || []).forEach((field) => {
    const value = state[field.id];
    if (field.type === "number" || field.type === "range") data[field.id] = Number(value || 0);
    else if (field.type === "checklist") data[field.id] = selectedList(field.id);
    else data[field.id] = value ?? "";
  });
  return data;
}

function evaluate(expression, data) {
  try {
    return Function("inputs", `"use strict"; const { ${Object.keys(data).join(", ")} } = inputs; return (${expression});`)(data);
  } catch (error) {
    return 0;
  }
}

function formatOutput(value, output) {
  if (output.format === "money") return money(value);
  if (output.format === "percent") return `${formatNumber(value, 1)}%`;
  if (output.format === "integer") return formatNumber(value, 0);
  return `${formatNumber(value, output.digits ?? 2)}${output.unit ? ` ${output.unit}` : ""}`;
}

function resultShell(summary, html, exportText) {
  window.lastExportText = exportText;
  return `<div class="result-summary">${summary}</div><div class="result-body">${html}</div>`;
}

function replaceTokens(text, data) {
  return String(text || "").replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const value = data[key];
    return Array.isArray(value) ? value.join(", ") : String(value ?? "");
  });
}

function calculatorTool() {
  const data = inputs();
  const outputs = (config.engine?.outputs || []).map((output) => ({
    ...output,
    value: evaluate(output.expr, data)
  }));
  const rules = (config.engine?.rules || [])
    .filter((rule) => !rule.if || Boolean(evaluate(rule.if, data)))
    .map((rule) => replaceTokens(rule.text, data));
  if (!rules.length) rules.push(config.engine?.defaultAdvice || "Inputs are within the expected planning range. Review assumptions before using the result.");
  const html = `<div class="metric-grid">${outputs.map((output) => `<div><span>${escapeHtml(output.label)}</span><strong>${escapeHtml(formatOutput(output.value, output))}</strong></div>`).join("")}</div><ul class="clean-list">${rules.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  const exportText = `${config.title}\n${outputs.map((output) => `${output.label}: ${formatOutput(output.value, output)}`).join("\n")}\n\nRecommendations\n- ${rules.join("\n- ")}`;
  return resultShell(`${outputs.length} calculated outputs ready.`, html, exportText);
}

function libraryTool() {
  const data = inputs();
  const query = String(data.query || "").toLowerCase();
  const category = data.category || "All";
  const items = (config.data?.items || []).filter((item) => {
    const text = `${item.title} ${item.category} ${item.use} ${item.note} ${item.tags || ""}`.toLowerCase();
    return (!query || text.includes(query)) && (category === "All" || item.category === category);
  }).slice(0, 12);
  const html = `<div class="result-list">${items.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.note)}</p><dl><dt>Use</dt><dd>${escapeHtml(item.use || "Reference")}</dd><dt>Caution</dt><dd>${escapeHtml(item.caution || "Verify against project standards.")}</dd></dl></article>`).join("") || "<p>No match yet. Try a shorter keyword or All categories.</p>"}</div>`;
  const exportText = items.map((item) => `${item.title} | ${item.category} | ${item.use || ""} | ${item.caution || ""}`).join("\n");
  return resultShell(`${items.length} reference items matched.`, html, exportText);
}

function builderTool() {
  const data = inputs();
  const sections = config.engine?.sections || [
    { title: "Starter", body: "{{projectName}}\n\nUse the generated structure as a first pass, then review details before publication." }
  ];
  const html = `<div class="doc-preview">${sections.map((section) => `<h3>${escapeHtml(replaceTokens(section.title, data))}</h3><p>${escapeHtml(replaceTokens(section.body, data)).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
  const exportText = sections.map((section) => `${replaceTokens(section.title, data)}\n${replaceTokens(section.body, data)}`).join("\n\n");
  return resultShell(`${sections.length} document sections generated.`, html, exportText);
}

function parseRows(text) {
  return String(text || "").split("\n").map((line) => line.split(",").map((part) => part.trim())).filter((row) => row.some(Boolean));
}

function scheduleTool() {
  const rows = parseRows(inputs().rows || "");
  const columns = config.engine?.columns || ["Item", "Qty", "Unit", "Notes"];
  const qtyIndex = config.engine?.qtyIndex ?? 1;
  const costIndex = config.engine?.costIndex ?? 2;
  const total = rows.reduce((sum, row) => sum + Number(row[qtyIndex] || 0) * Number(row[costIndex] || 0), 0);
  const warnings = [];
  rows.forEach((row, index) => {
    if (row.length < columns.length) warnings.push(`Row ${index + 1} is missing fields.`);
    if (Number.isNaN(Number(row[qtyIndex] || 0))) warnings.push(`Row ${index + 1} needs a numeric quantity.`);
  });
  const html = `<div class="metric-grid"><div><span>Rows</span><strong>${rows.length}</strong></div><div><span>Estimated total</span><strong>${money(total)}</strong></div><div><span>Warnings</span><strong>${warnings.length}</strong></div></div><div class="table-wrap"><table><thead><tr>${columns.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${warnings.length ? `<ul class="warn-list">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="good">No obvious schedule gaps found.</p>`}`;
  const csv = `${columns.join(",")}\n${rows.map((row) => columns.map((_, index) => `"${String(row[index] || "").replaceAll('"', '""')}"`).join(",")).join("\n")}`;
  return resultShell(`${rows.length} rows prepared.`, html, csv);
}

function checklistTool() {
  const data = inputs();
  const selected = data.items || data.checks || [];
  const items = config.data?.items || [];
  const selectedItems = items.filter((item) => selected.includes(item.title));
  const risk = selectedItems.reduce((sum, item) => sum + Number(item.weight || 1), 0);
  const maxRisk = items.reduce((sum, item) => sum + Number(item.weight || 1), 0) || 1;
  const score = Math.max(0, 100 - (risk / maxRisk) * 100);
  const html = `<div class="metric-grid"><div><span>Open items</span><strong>${selectedItems.length}</strong></div><div><span>Readiness</span><strong>${score.toFixed(0)}%</strong></div><div><span>Risk points</span><strong>${risk}</strong></div></div><div class="result-list">${selectedItems.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.note || "Resolve before final issue.")}</p><small>${escapeHtml(item.category || "Review")}</small></article>`).join("") || "<p class=\"good\">No risk items selected. Keep a final human review step.</p>"}</div>`;
  const exportText = `${config.title}\nReadiness: ${score.toFixed(0)}%\nOpen items:\n- ${selectedItems.map((item) => `${item.title}: ${item.note || ""}`).join("\n- ")}`;
  return resultShell(`Readiness score: <strong>${score.toFixed(0)}%</strong>`, html, exportText);
}

function matrixTool() {
  const data = inputs();
  const rows = parseRows(data.rows || "");
  const weights = config.engine?.weights || { Quality: 0.4, Cost: 0.3, Speed: 0.3 };
  const weightValues = Object.values(weights);
  const ranked = rows.map((row) => {
    const score = weightValues.reduce((sum, weight, index) => sum + Number(row[index + 1] || 0) * weight, 0);
    return { name: row[0] || "Option", score, row };
  }).sort((a, b) => b.score - a.score);
  const html = `<div class="result-list">${ranked.map((item, index) => `<article><h3>${index + 1}. ${escapeHtml(item.name)}</h3><p>Weighted score: <strong>${item.score.toFixed(2)}</strong></p><small>${Object.keys(weights).join(" / ")}</small></article>`).join("")}</div>`;
  const exportText = ranked.map((item, index) => `${index + 1}. ${item.name}: ${item.score.toFixed(2)}`).join("\n");
  return resultShell(`${ranked.length} options ranked.`, html, exportText);
}

function promptTool() {
  const data = inputs();
  const variants = config.engine?.variants || [
    { title: "Prompt", body: "Create {{projectType}} with {{style}} and practical constraints." }
  ];
  const html = `<div class="prompt-stack">${variants.map((item) => `<article><h3>${escapeHtml(replaceTokens(item.title, data))}</h3><p>${escapeHtml(replaceTokens(item.body, data))}</p></article>`).join("")}</div>`;
  const exportText = variants.map((item) => `${replaceTokens(item.title, data)}\n${replaceTokens(item.body, data)}`).join("\n\n");
  return resultShell(`${variants.length} prompt variants generated.`, html, exportText);
}

function hexToRgb(hex) {
  const clean = String(hex || "#000000").replace("#", "");
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) || 0);
}

function luminance(hex) {
  const values = hexToRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

function contrastTool() {
  const data = inputs();
  const fg = data.foreground || "#12312d";
  const bg = data.background || "#ffffff";
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const normal = ratio >= 4.5 ? "Pass" : "Review";
  const large = ratio >= 3 ? "Pass" : "Review";
  const html = `<div class="metric-grid"><div><span>Contrast</span><strong>${ratio.toFixed(2)}:1</strong></div><div><span>Normal text</span><strong>${normal}</strong></div><div><span>Large text</span><strong>${large}</strong></div></div><div class="swatch-row"><div class="swatch" style="background:${fg};color:${bg}"><span>Foreground</span><strong>${escapeHtml(fg)}</strong></div><div class="swatch" style="background:${bg};color:${fg}"><span>Background</span><strong>${escapeHtml(bg)}</strong></div></div>`;
  return resultShell(`Contrast ratio: <strong>${ratio.toFixed(2)}:1</strong>`, html, `Contrast ratio: ${ratio.toFixed(2)}:1\nNormal text: ${normal}\nLarge text: ${large}`);
}

function renderResult() {
  const map = {
    calculator: calculatorTool,
    library: libraryTool,
    builder: builderTool,
    schedule: scheduleTool,
    checklist: checklistTool,
    matrix: matrixTool,
    prompt: promptTool,
    contrast: contrastTool
  };
  qs("#toolResult").innerHTML = (map[config.kind] || builderTool)();
}

function renderStaticContent() {
  qs("#examples").innerHTML = (config.examples || []).map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("");
  qs("#faq").innerHTML = (config.faq || []).map((item) => `<details><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`).join("");
  qs("#limits").innerHTML = (config.limits || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

async function copyExport() {
  const text = window.lastExportText || "";
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    qs("#copyExport").textContent = "Copied";
    setTimeout(() => qs("#copyExport").textContent = "Copy output", 1200);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function boot() {
  initState();
  renderForm();
  renderResult();
  renderStaticContent();
  qs("#toolFields").addEventListener("input", updateFromEvent);
  qs("#toolFields").addEventListener("change", updateFromEvent);
  qs("#copyExport").addEventListener("click", copyExport);
}

boot();
