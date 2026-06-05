
(function(){
  const config=window.SITE_CONFIG||{};
  const key="premium-projects:"+location.hostname+":"+(config.title||"tool");
  const settingsKey="premium-settings:"+location.hostname;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const esc=(v)=>String(v||"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  const get=(k)=>JSON.parse(localStorage.getItem(k)||"[]");
  const set=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function payload(){
    const fields={};
    $$("[data-field]").forEach((n)=>fields[n.dataset.field]=n.value);
    $$("[data-checkgroup]").forEach((n)=>{fields[n.dataset.checkgroup]=fields[n.dataset.checkgroup]||[]; if(n.checked) fields[n.dataset.checkgroup].push(n.value);});
    return {title:config.title||document.title,url:location.href,createdAt:new Date().toISOString(),fields,output:window.lastExportText||""};
  }
  function download(data,name){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=String(name||"export").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".json"; a.click(); URL.revokeObjectURL(a.href);
  }
  function renderProjects(){
    const items=get(key);
    $$("[data-project-count]").forEach((n)=>n.textContent=String(items.length));
    $$("[data-project-list]").forEach((root)=>{root.innerHTML=items.length?items.map((item,i)=>'<article class="info-card"><span>'+esc(new Date(item.createdAt).toLocaleString())+'</span><h3>'+esc(item.name||item.title)+'</h3><p>'+esc((item.output||"Saved project").slice(0,180))+'</p><button class="button secondary" data-download-project="'+i+'" type="button">Download JSON</button></article>').join(""):'<p class="muted">No saved projects yet. Run the tool and save an output.</p>';});
  }
  document.addEventListener("click",(e)=>{
    const save=e.target.closest("[data-save-current]");
    if(save){const item=payload(); item.name=prompt("Project name",item.title)||item.title; set(key,[item,...get(key)].slice(0,50)); renderProjects();}
    const dl=e.target.closest("[data-download-current]");
    if(dl) download(payload(),config.title||"tool-export");
    const item=e.target.closest("[data-download-project]");
    if(item){const data=get(key)[Number(item.dataset.downloadProject)]; if(data) download(data,data.name||data.title);}
    const clear=e.target.closest("[data-clear-projects]");
    if(clear&&confirm("Clear saved projects in this browser?")){set(key,[]); renderProjects();}
    const copy=e.target.closest("[data-copy-section]");
    if(copy){const root=copy.closest("[data-copy-root]")||document.body; navigator.clipboard?.writeText(root.innerText.trim()); copy.textContent="Copied"; setTimeout(()=>copy.textContent="Copy",1200);}
    const saveSettings=e.target.closest("[data-save-settings]");
    if(saveSettings){const data={}; $$("[data-setting]").forEach((n)=>data[n.dataset.setting]=n.value); localStorage.setItem(settingsKey,JSON.stringify(data)); const note=$("[data-settings-status]"); if(note) note.textContent="Saved locally.";}
  });
  const settings=JSON.parse(localStorage.getItem(settingsKey)||"{}");
  $$("[data-setting]").forEach((n)=>n.value=settings[n.dataset.setting]||n.dataset.default||n.value||"");
  renderProjects();
})();
