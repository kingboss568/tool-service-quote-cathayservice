const config = window.SITE_CONFIG;
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

function slug(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function numberValue(id) {
  return Number(state[id] || 0);
}

function textValue(id) {
  return String(state[id] ?? "");
}

function selectedList(id) {
  return Array.isArray(state[id]) ? state[id] : [];
}

function initState() {
  config.fields.forEach((field) => {
    if (field.type === "checklist") {
      state[field.id] = field.default || [];
    } else {
      state[field.id] = field.default ?? "";
    }
  });
}

function renderField(field) {
  const hint = field.hint ? `<span class="field-hint">${escapeHtml(field.hint)}</span>` : "";
  const value = state[field.id] ?? "";
  if (field.type === "select") {
    return `<label class="field"><span>${escapeHtml(field.label)}</span>${hint}<select data-field="${field.id}">${field.options.map((item) => `<option value="${escapeHtml(item)}" ${item === value ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label>`;
  }
  if (field.type === "textarea") {
    return `<label class="field field-wide"><span>${escapeHtml(field.label)}</span>${hint}<textarea data-field="${field.id}" rows="${field.rows || 5}">${escapeHtml(value)}</textarea></label>`;
  }
  if (field.type === "color") {
    return `<label class="field"><span>${escapeHtml(field.label)}</span>${hint}<input type="color" data-field="${field.id}" value="${escapeHtml(value)}"></label>`;
  }
  if (field.type === "checklist") {
    return `<fieldset class="field field-wide"><legend>${escapeHtml(field.label)}</legend>${hint}<div class="check-grid">${field.options.map((item) => {
      const checked = selectedList(field.id).includes(item) ? "checked" : "";
      return `<label><input type="checkbox" data-checkgroup="${field.id}" value="${escapeHtml(item)}" ${checked}> ${escapeHtml(item)}</label>`;
    }).join("")}</div></fieldset>`;
  }
  const inputType = field.type === "number" ? "number" : "text";
  const step = field.step ? ` step="${escapeHtml(field.step)}"` : "";
  const min = field.min !== undefined ? ` min="${escapeHtml(field.min)}"` : "";
  return `<label class="field"><span>${escapeHtml(field.label)}</span>${hint}<input type="${inputType}" data-field="${field.id}" value="${escapeHtml(value)}"${step}${min}></label>`;
}

function renderForm() {
  qs("#toolFields").innerHTML = config.fields.map(renderField).join("");
}

function updateFromEvent(event) {
  const target = event.target;
  if (target.matches("[data-field]")) {
    state[target.dataset.field] = target.value;
    renderResult();
  }
  if (target.matches("[data-checkgroup]")) {
    const group = target.dataset.checkgroup;
    const values = qsa(`[data-checkgroup="${group}"]:checked`).map((node) => node.value);
    state[group] = values;
    renderResult();
  }
  if (target.matches("[data-quiz]")) {
    state[target.name] = target.value;
    renderResult();
  }
}

function setExport(text) {
  window.lastExportText = text;
}

function resultShell(summary, html, exportText) {
  setExport(exportText);
  return `<div class="result-summary">${summary}</div><div class="result-body">${html}</div>`;
}

function aiCostTool() {
  const dailyRequests = numberValue("dailyRequests");
  const inputTokens = numberValue("inputTokens");
  const outputTokens = numberValue("outputTokens");
  const imageCount = numberValue("imageCount");
  const audioMinutes = numberValue("audioMinutes");
  const agentSteps = Math.max(1, numberValue("agentSteps"));
  const model = textValue("modelTier");
  const rates = {
    "Economy model": { in: 0.15, out: 0.6, image: 0.018, audio: 0.006 },
    "Balanced model": { in: 0.6, out: 2.4, image: 0.04, audio: 0.012 },
    "Premium model": { in: 2.5, out: 10, image: 0.09, audio: 0.024 }
  }[model];
  const tokenCostDaily = ((dailyRequests * agentSteps * inputTokens) / 1000000) * rates.in + ((dailyRequests * agentSteps * outputTokens) / 1000000) * rates.out;
  const mediaCostDaily = imageCount * rates.image + audioMinutes * rates.audio;
  const expected = (tokenCostDaily + mediaCostDaily) * 30;
  const low = expected * 0.65;
  const high = expected * 1.45;
  const advice = [];
  if (inputTokens > 2500 || agentSteps > 4) advice.push("Cache repeated context and split long agent workflows into reusable steps.");
  if (dailyRequests > 1000) advice.push("Batch non-urgent jobs and reserve the premium model for review or exception handling.");
  if (outputTokens > inputTokens) advice.push("Set tighter response formats so generated output stays predictable.");
  if (!advice.length) advice.push("This workload is small enough to keep simple; monitor real invoices before optimizing.");
  const html = `
    <div class="metric-grid">
      <div><span>Low</span><strong>${money(low)}</strong></div>
      <div><span>Expected</span><strong>${money(expected)}</strong></div>
      <div><span>High</span><strong>${money(high)}</strong></div>
    </div>
    <div class="meter"><i style="width:${Math.min(100, expected / 20)}%"></i></div>
    <ul class="clean-list">${advice.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  `;
  const exportText = `AI cost estimate\nModel: ${model}\nLow: ${money(low)}\nExpected: ${money(expected)}\nHigh: ${money(high)}\nAdvice:\n- ${advice.join("\n- ")}`;
  return resultShell(`Expected monthly cost: <strong>${money(expected)}</strong>`, html, exportText);
}

function promptBuilderTool() {
  const building = textValue("buildingType");
  const climate = textValue("climate");
  const material = textValue("material");
  const style = textValue("style");
  const camera = textValue("camera");
  const brief = textValue("brief");
  const base = `${building} in a ${climate} setting, ${material} material language, ${style} design logic, ${brief}`.replace(/\s+/g, " ").trim();
  const prompts = [
    { name: "Concept sketch", text: `${base}. Early architectural concept sketch, readable massing, site response, hand-drawn linework, concise annotations, ${camera}.` },
    { name: "Photoreal render", text: `${base}. Photoreal architectural visualization, realistic material seams, natural light, human scale, context-aware landscaping, ${camera}.` },
    { name: "Technical diagram", text: `${base}. Technical architectural diagram, clean section logic, circulation arrows, structural rhythm, restrained color coding, ${camera}.` }
  ];
  const negative = "unsafe structure, impossible cantilever, copied signature style, distorted stairs, unreadable plan, fake construction detail";
  const html = `<div class="prompt-stack">${prompts.map((item) => `<article><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.text)}</p></article>`).join("")}</div><div class="note"><strong>Negative prompt</strong><p>${escapeHtml(negative)}</p></div>`;
  const exportText = prompts.map((item) => `${item.name}\n${item.text}`).join("\n\n") + `\n\nNegative prompt\n${negative}`;
  return resultShell("Three architect-grade prompt variants are ready.", html, exportText);
}

function quizTool() {
  const level = textValue("level");
  const bank = config.data.questions.filter((item) => item.level === level || level === "Mixed");
  const questions = bank.slice(0, 6);
  const answered = questions.filter((item, index) => state[`quiz-${index}`]).length;
  const correct = questions.filter((item, index) => state[`quiz-${index}`] === item.answer).length;
  const html = `<div class="quiz-list">${questions.map((item, index) => `
    <article class="quiz-item">
      <h3>${index + 1}. ${escapeHtml(item.q)}</h3>
      ${item.options.map((option) => `<label><input type="radio" name="quiz-${index}" data-quiz value="${escapeHtml(option)}" ${state[`quiz-${index}`] === option ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}
      ${state[`quiz-${index}`] ? `<p class="${state[`quiz-${index}`] === item.answer ? "good" : "warn"}">${state[`quiz-${index}`] === item.answer ? "Correct" : `Answer: ${escapeHtml(item.answer)}`}. ${escapeHtml(item.why)}</p>` : ""}
    </article>`).join("")}</div>
    <div class="note">Next practice: ${escapeHtml(config.data.paths[level] || config.data.paths.Mixed)}</div>`;
  const exportText = `AutoCAD practice result\nLevel: ${level}\nAnswered: ${answered}/${questions.length}\nCorrect: ${correct}/${questions.length}`;
  return resultShell(`Score: <strong>${correct}/${questions.length}</strong> with ${answered} answered`, html, exportText);
}

function privacyTool() {
  const product = textValue("productName") || "This product";
  const audience = textValue("audience");
  const items = selectedList("dataTypes");
  const features = selectedList("features");
  const clauses = [
    `${product} collects only the information needed to operate the service and respond to user requests.`,
    items.length ? `Data categories to review: ${items.join(", ")}.` : "No personal data category has been selected yet.",
    features.includes("Advertising") ? "If ads are displayed, disclose advertising partners and interest-based advertising choices." : "No advertising disclosure was selected.",
    features.includes("Analytics") ? "If analytics are used, explain measurement purpose, retention, and opt-out options." : "No analytics disclosure was selected.",
    features.includes("AI features") ? "For AI features, explain user input handling and avoid submitting sensitive information." : "No AI-specific clause was selected.",
    audience === "Children may use it" ? "Do not publish until a qualified reviewer confirms children privacy obligations." : "The product is not currently marked as child-directed."
  ];
  const checklist = ["Add contact email", "Name data processors", "Confirm retention period", "Add effective date", "Have counsel review before publication"];
  const html = `<div class="doc-preview">${clauses.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div><ul class="checklist">${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  const exportText = `${product} privacy policy starter\n\n${clauses.join("\n\n")}\n\nChecklist\n- ${checklist.join("\n- ")}\n\nLegal note: this starter is not legal advice.`;
  return resultShell("Starter document and review checklist generated.", html, exportText);
}

function searchDataset(items, query, category) {
  const q = query.toLowerCase();
  return items.filter((item) => {
    const haystack = `${item.title} ${item.category} ${item.note} ${item.tags || ""}`.toLowerCase();
    const queryOk = !q || haystack.includes(q);
    const categoryOk = category === "All" || item.category === category || item.scene === category;
    return queryOk && categoryOk;
  }).slice(0, 8);
}

function cadSearchTool() {
  const matches = searchDataset(config.data.items, textValue("query"), textValue("category"));
  const html = `<div class="result-list">${matches.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.note)}</p><dl><dt>Type</dt><dd>${escapeHtml(item.type)}</dd><dt>Use</dt><dd>${escapeHtml(item.use)}</dd><dt>Caution</dt><dd>${escapeHtml(item.caution)}</dd></dl></article>`).join("") || "<p>No matching resources yet. Try a broader category or shorter keyword.</p>"}</div>`;
  const exportText = matches.map((item) => `${item.title} | ${item.type} | ${item.use} | ${item.caution}`).join("\n");
  return resultShell(`${matches.length} resource notes matched.`, html, exportText);
}

function hvacTool() {
  const matches = searchDataset(config.data.symbols, textValue("query"), textValue("category"));
  const checklist = ["Confirm symbol legend", "Use consistent MEP layer names", "Check scale in reflected ceiling plans", "Coordinate diffuser and lighting layout", "Review equipment tags before issue"];
  const html = `<div class="symbol-grid">${matches.map((item) => `<article><div class="symbol-mark">${escapeHtml(item.mark)}</div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.note)}</p><small>${escapeHtml(item.layer)}</small></article>`).join("")}</div><ul class="checklist">${checklist.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  const exportText = `HVAC drawing checklist\n- ${checklist.join("\n- ")}\n\nSymbols\n${matches.map((item) => `${item.mark} ${item.title}: ${item.note}`).join("\n")}`;
  return resultShell(`${matches.length} HVAC symbols in view.`, html, exportText);
}

function parseRows(text) {
  return text.split("\n").map((line) => line.split(",").map((part) => part.trim())).filter((row) => row.some(Boolean));
}

function scheduleTool() {
  const rows = parseRows(textValue("rows"));
  const warnings = [];
  rows.forEach((row, index) => {
    if (row.length < 7) warnings.push(`Row ${index + 1} is missing fields.`);
    if (Number(row[2]) <= 0 || Number(row[3]) <= 0) warnings.push(`Row ${index + 1} needs valid width and height.`);
  });
  const html = `<div class="table-wrap"><table><thead><tr><th>Tag</th><th>Type</th><th>W</th><th>H</th><th>Material</th><th>Qty</th><th>Floor</th><th>Notes</th></tr></thead><tbody>${rows.map((row) => `<tr>${Array.from({ length: 8 }, (_, i) => `<td>${escapeHtml(row[i] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${warnings.length ? `<ul class="warn-list">${warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="good">No obvious schedule gaps found.</p>`}`;
  const csv = "Tag,Type,Width,Height,Material,Qty,Floor,Notes\n" + rows.map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(",")).join("\n");
  return resultShell(`${rows.length} schedule rows prepared.`, html, csv);
}

function quoteTool() {
  const rows = parseRows(textValue("items"));
  const tax = numberValue("tax") / 100;
  const discount = numberValue("discount");
  const subtotal = rows.reduce((sum, row) => sum + Number(row[1] || 0) * Number(row[2] || 0), 0);
  const taxed = Math.max(0, subtotal - discount) * tax;
  const total = Math.max(0, subtotal - discount) + taxed;
  const html = `<div class="metric-grid"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>Tax</span><strong>${money(taxed)}</strong></div><div><span>Total</span><strong>${money(total)}</strong></div></div><div class="table-wrap"><table><thead><tr><th>Service</th><th>Unit</th><th>Qty</th><th>Line</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row[0] || "")}</td><td>${money(row[1] || 0)}</td><td>${escapeHtml(row[2] || "")}</td><td>${money(Number(row[1] || 0) * Number(row[2] || 0))}</td></tr>`).join("")}</tbody></table></div>`;
  const exportText = `Service quote\nClient: ${textValue("client")}\nSubtotal: ${money(subtotal)}\nDiscount: ${money(discount)}\nTax: ${money(taxed)}\nTotal: ${money(total)}\nTerms: ${textValue("terms")}`;
  return resultShell(`Quote total: <strong>${money(total)}</strong>`, html, exportText);
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function adjust(hex, amount) {
  const rgb = hexToRgb(hex);
  return rgbToHex(rgb.map((value) => value + amount));
}

function paletteTool() {
  const base = textValue("baseColor") || "#2f6f73";
  const mood = textValue("mood");
  const palette = [
    { role: "Background", hex: adjust(base, 112), ratio: "60%" },
    { role: "Surface", hex: adjust(base, 72), ratio: "20%" },
    { role: "Accent", hex: base, ratio: "10%" },
    { role: "Deep text", hex: adjust(base, -88), ratio: "8%" },
    { role: "Alert", hex: config.data.alert, ratio: "2%" }
  ];
  const html = `<div class="swatch-row">${palette.map((item) => `<div class="swatch" style="background:${item.hex}; color:${item.role === "Deep text" ? "#fff" : "#111"}"><span>${escapeHtml(item.role)}</span><strong>${escapeHtml(item.hex)}</strong><small>${escapeHtml(item.ratio)}</small></div>`).join("")}</div><p class="note">${escapeHtml(mood)} palette with role-based usage. Check final text contrast before publishing.</p>`;
  const css = `:root {\n${palette.map((item) => `  --${slug(item.role)}: ${item.hex};`).join("\n")}\n}`;
  return resultShell("Palette and CSS variables generated.", html, css);
}

function blockFinderTool() {
  const scene = textValue("scene");
  const pack = config.data.scenes[scene] || config.data.scenes[Object.keys(config.data.scenes)[0]];
  const html = `<div class="result-list">${pack.blocks.map((item) => `<article><h3>${escapeHtml(item)}</h3><p>${escapeHtml(pack.notes[item] || "Use a clean layer name and confirm scale before inserting.")}</p></article>`).join("")}</div><div class="note">Suggested package: ${escapeHtml(pack.package)}</div>`;
  const exportText = `${scene} CAD block checklist\n- ${pack.blocks.join("\n- ")}\nPackage: ${pack.package}`;
  return resultShell(`${pack.blocks.length} CAD block needs identified.`, html, exportText);
}

function dwgChecklistTool() {
  const phase = textValue("phase");
  const selected = selectedList("checks");
  const issues = config.data.issueMap[phase] || [];
  const html = `<ul class="checklist">${selected.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul><div class="result-list">${issues.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.fix)}</p></article>`).join("")}</div>`;
  const exportText = `DWG to PDF preflight\nPhase: ${phase}\nChecklist:\n- ${selected.join("\n- ")}\n\nCommon issues:\n${issues.map((item) => `- ${item.title}: ${item.fix}`).join("\n")}`;
  return resultShell(`${selected.length} preflight checks selected.`, html, exportText);
}

function paintTool() {
  const width = numberValue("width");
  const length = numberValue("length");
  const height = numberValue("height");
  const coats = numberValue("coats");
  const doors = numberValue("doors") * 21;
  const windows = numberValue("windows") * 15;
  const coverage = numberValue("coverage");
  const waste = 1 + numberValue("waste") / 100;
  const wallArea = Math.max(0, (2 * (width + length) * height - doors - windows) * coats);
  const gallons = coverage ? (wallArea / coverage) * waste : 0;
  const liters = gallons * 3.78541;
  const cost = gallons * numberValue("price");
  const html = `<div class="metric-grid"><div><span>Paint</span><strong>${gallons.toFixed(2)} gal</strong></div><div><span>Liters</span><strong>${liters.toFixed(1)} L</strong></div><div><span>Budget</span><strong>${money(cost)}</strong></div></div><ul class="checklist"><li>Primer: ${textValue("primer")}</li><li>Roller cover, tray, tape, drop cloth</li><li>Keep one labeled touch-up container</li></ul>`;
  const exportText = `Paint estimate\nArea: ${wallArea.toFixed(1)} sq ft\nPaint: ${gallons.toFixed(2)} gal / ${liters.toFixed(1)} L\nBudget: ${money(cost)}`;
  return resultShell(`Estimated paint: <strong>${gallons.toFixed(2)} gallons</strong>`, html, exportText);
}

function schemaTool() {
  const type = textValue("schemaType");
  const name = textValue("name");
  const url = textValue("url");
  const description = textValue("description");
  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    name,
    url,
    description
  };
  if (type === "FAQPage") {
    schema.mainEntity = parseRows(textValue("faqRows")).slice(0, 5).map((row) => ({
      "@type": "Question",
      name: row[0] || "Question",
      acceptedAnswer: { "@type": "Answer", text: row[1] || "Answer" }
    }));
  }
  if (type === "HowTo") {
    schema.step = textValue("steps").split("\n").filter(Boolean).map((item) => ({ "@type": "HowToStep", text: item.trim() }));
  }
  if (type === "Product" || type === "SoftwareApplication") {
    schema.offers = { "@type": "Offer", price: textValue("price") || "0", priceCurrency: "USD" };
  }
  const json = JSON.stringify(schema, null, 2);
  const html = `<pre class="code-block">${escapeHtml(json)}</pre><ul class="checklist"><li>Validate in a structured data testing tool.</li><li>Keep visible page content consistent with JSON-LD.</li><li>Do not mark up fake reviews or unavailable products.</li></ul>`;
  return resultShell(`${escapeHtml(type)} JSON-LD generated.`, html, `<script type="application/ld+json">\n${json}\n</script>`);
}

function glossaryTool() {
  const matches = searchDataset(config.data.terms, textValue("query"), textValue("category"));
  const html = `<div class="term-list">${matches.map((item) => `<article><h3>${escapeHtml(item.en)} <span>${escapeHtml(item.zh)}</span></h3><p>${escapeHtml(item.definition)}</p><blockquote>${escapeHtml(item.example)}</blockquote><small>Related: ${escapeHtml(item.related.join(", "))}</small></article>`).join("") || "<p>No term matched. Try wall, beam, section, facade, or waterproofing.</p>"}</div>`;
  const exportText = matches.map((item) => `${item.en} / ${item.zh}\n${item.definition}\nExample: ${item.example}\nRelated: ${item.related.join(", ")}`).join("\n\n");
  return resultShell(`${matches.length} glossary terms matched.`, html, exportText);
}

function renderResult() {
  const map = {
    aiCost: aiCostTool,
    promptBuilder: promptBuilderTool,
    quiz: quizTool,
    privacy: privacyTool,
    cadSearch: cadSearchTool,
    hvac: hvacTool,
    schedule: scheduleTool,
    quote: quoteTool,
    palette: paletteTool,
    blockSearch: cadSearchTool,
    blockFinder: blockFinderTool,
    dwgChecklist: dwgChecklistTool,
    paint: paintTool,
    schema: schemaTool,
    glossary: glossaryTool
  };
  qs("#toolResult").innerHTML = map[config.kind]();
}

function renderStaticContent() {
  qs("#examples").innerHTML = config.examples.map((item) => `<article><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`).join("");
  qs("#faq").innerHTML = config.faq.map((item) => `<details><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`).join("");
  qs("#limits").innerHTML = config.limits.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
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
  qs("#toolResult").addEventListener("change", updateFromEvent);
  qs("#copyExport").addEventListener("click", copyExport);
  qsa("[data-current-year]").forEach((node) => node.textContent = new Date().getFullYear());
}

boot();
