
(function () {
  const config = window.SITE_CONFIG || {};
  const key = "saas-projects:" + location.hostname + ":" + (config.kind || "tool");
  const settingsKey = "saas-settings:" + location.hostname;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const escape = (value) => String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
  const projects = () => JSON.parse(localStorage.getItem(key) || "[]");
  const setProjects = (items) => localStorage.setItem(key, JSON.stringify(items.slice(0, 40)));
  const settings = () => JSON.parse(localStorage.getItem(settingsKey) || "{}");
  const setSettings = (value) => localStorage.setItem(settingsKey, JSON.stringify(value));
  function currentPayload() {
    const fields = {};
    $$("[data-field]").forEach((node) => fields[node.dataset.field] = node.value);
    $$("[data-checkgroup]").forEach((node) => {
      if (!fields[node.dataset.checkgroup]) fields[node.dataset.checkgroup] = [];
      if (node.checked) fields[node.dataset.checkgroup].push(node.value);
    });
    return {
      title: config.title || document.title,
      page: location.pathname,
      createdAt: new Date().toISOString(),
      fields,
      output: window.lastExportText || ""
    };
  }
  function saveCurrent() {
    const item = currentPayload();
    const name = prompt("Project name", item.title + " " + new Date().toLocaleDateString()) || item.title;
    item.name = name;
    setProjects([item, ...projects()]);
    renderProjects();
    return item;
  }
  function downloadJson(payload, name) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".json";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  function renderProjects() {
    $$("[data-project-list]").forEach((root) => {
      const items = projects();
      root.innerHTML = items.length ? items.map((item, index) => '<article class="workspace-card"><span>' + escape(new Date(item.createdAt).toLocaleString()) + '</span><h3>' + escape(item.name || item.title) + '</h3><p>' + escape((item.output || "Saved input package").slice(0, 180)) + '</p><button class="button secondary" data-download-project="' + index + '">Download JSON</button></article>').join("") : '<div class="empty-state">No saved projects yet. Run the tool and use Save project.</div>';
    });
    $$("[data-project-count]").forEach((node) => node.textContent = String(projects().length));
  }
  function renderSettings() {
    const data = settings();
    $$("[data-setting]").forEach((node) => node.value = data[node.dataset.setting] || node.dataset.default || "");
  }
  function saveSettings() {
    const data = {};
    $$("[data-setting]").forEach((node) => data[node.dataset.setting] = node.value);
    setSettings(data);
    const note = $("[data-settings-status]");
    if (note) note.textContent = "Saved locally";
  }
  document.addEventListener("click", (event) => {
    const save = event.target.closest("[data-save-current]");
    if (save) saveCurrent();
    const download = event.target.closest("[data-download-current]");
    if (download) downloadJson(currentPayload(), config.title || "tool-export");
    const project = event.target.closest("[data-download-project]");
    if (project) {
      const item = projects()[Number(project.dataset.downloadProject)];
      if (item) downloadJson(item, item.name || item.title);
    }
    const copy = event.target.closest("[data-copy-section]");
    if (copy) {
      const root = copy.closest("[data-copy-root]") || document.body;
      navigator.clipboard?.writeText(root.innerText.trim());
      copy.textContent = "Copied";
      setTimeout(() => copy.textContent = "Copy", 1200);
    }
    const clear = event.target.closest("[data-clear-projects]");
    if (clear && confirm("Clear saved projects on this browser?")) {
      setProjects([]);
      renderProjects();
    }
    const settingsButton = event.target.closest("[data-save-settings]");
    if (settingsButton) saveSettings();
  });
  document.addEventListener("input", (event) => {
    const search = event.target.closest("[data-template-search]");
    if (search) {
      const term = search.value.toLowerCase();
      $$("[data-template-card]").forEach((card) => {
        card.dataset.hidden = card.innerText.toLowerCase().includes(term) ? "false" : "true";
      });
    }
  });
  renderProjects();
  renderSettings();
})();
