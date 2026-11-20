const STORAGE_KEY = "horas-extra-registros-v1";
const $ = (id) => document.getElementById(id);
const form = $("entryForm");
const entriesEl = $("entries");
const errorEl = $("formError");
let records = loadRecords();

function normalizeRecord(r) {
  return { id: r.id, start: r.start, end: r.end, minutes: r.minutes };
}
function validRecord(r) {
  return r && typeof r.id === "string" &&
    (!("date" in r) || /^\\d{4}-\\d{2}-\\d{2}$/.test(r.date)) &&
    /^([01]\\d|2[0-3]):[0-5]\\d$/.test(r.start) &&
    /^([01]\\d|2[0-3]):[0-5]\\d$/.test(r.end) &&
    Number.isInteger(r.minutes) && r.minutes > 0 && r.minutes < 1440;
}
function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(validRecord).map(normalizeRecord) : [];
  } catch { return []; }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    $("saveState").textContent = "Guardado";
    $("saveState").style.color = "#236c4d";
  } catch {
    $("saveState").textContent = "No se pudo guardar";
    $("saveState").style.color = "#a3261e";
  }
}
function parseTime(value) {
  const match = String(value).trim().match(/^(\\d{1,2}):?(\\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}`;
}
function formatTimeInput(input) {
  input.value = input.value.replace(/\\D/g,"").slice(0,4);
}
function prepareTimeInput(input) {
  input.value = input.value.replace(/\\D/g,"").slice(0,4);
}
function finishTimeInput(input) {
  const parsed = parseTime(input.value);
  if (parsed) input.value = parsed;
}
function duration(start,end) {
  const [sh,sm] = start.split(":").map(Number);
  const [eh,em] = end.split(":").map(Number);
  return eh*60+em-(sh*60+sm);
}
function formatMinutes(total) {
  return `${Math.floor(total/60)} h ${String(total%60).padStart(2,"0")} min`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function render() {
  const total = records.reduce((sum,r)=>sum+r.minutes,0);
  $("grandTotal").textContent = formatMinutes(total);
  $("entryCount").textContent = `${records.length} ${records.length===1?"registro":"registros"}`;
  if (!records.length) {
    entriesEl.innerHTML = '<p class="empty">Todavía no hay cálculos registrados.</p>';
  } else {
    entriesEl.innerHTML = records.map((r,index)=>`
      <article class="entry">
        <div>
          <div class="entry-number">Registro ${index+1}</div>
          <div class="entry-times">${escapeHtml(r.start)} a ${escapeHtml(r.end)}</div>
        </div>
        <div class="entry-duration">${formatMinutes(r.minutes)}</div>
        <button class="delete" type="button" data-delete="${escapeHtml(r.id)}" aria-label="Eliminar registro ${index+1}">Eliminar registro</button>
      </article>`).join("");
  }
  $("clearAllBtn").disabled = records.length === 0;
}

["startTime","endTime"].forEach(id=>{
  const input=$(id);
  input.addEventListener("focus",()=>prepareTimeInput(input));
  input.addEventListener("input",()=>formatTimeInput(input));
  input.addEventListener("blur",()=>finishTimeInput(input));
});
form.addEventListener("submit",(event)=>{
  event.preventDefault();
  errorEl.textContent="";
  const start=parseTime($("startTime").value), end=parseTime($("endTime").value);
  if (!start||!end) { errorEl.textContent="Escribe horarios válidos, por ejemplo 1730."; return; }
  const mins=duration(start,end);
  if (mins<=0) { errorEl.textContent="La hora de término debe ser posterior a la de inicio. Revisa los horarios."; return; }
  if (mins>=12*60) { errorEl.textContent="La duración supera 12 horas. Revisa que los horarios estén correctos."; return; }
  records.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,start,end,minutes:mins});
  save();
  $("startTime").value="";
  $("endTime").value="";
  render();
});
$("clearAllBtn").addEventListener("click",()=>{
  if (!records.length) return;
  if (!confirm(`Vas a borrar los ${records.length} registros guardados. Esta acción no se puede deshacer. ¿Continuar?`)) return;
  records=[];
  save();
  render();
});
entriesEl.addEventListener("click",(event)=>{
  const button=event.target.closest("[data-delete]");
  if (!button) return;
  const index=records.findIndex(r=>r.id===button.dataset.delete);
  if (index<0 || !confirm(`¿Eliminar el Registro ${index+1}?`)) return;
  records=records.filter(r=>r.id!==button.dataset.delete);
  save();
  render();
});
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({app:"Horas Extra",version:2,exportedAt:new Date().toISOString(),records},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="respaldo-horas-extra.json"; a.click();
  URL.revokeObjectURL(url);
});
$("importFile").addEventListener("change",async(event)=>{
  const file=event.target.files[0]; if(!file)return;
  try {
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.records)||!data.records.every(validRecord)) throw new Error("Formato inválido");
    if(!confirm(`El respaldo contiene ${data.records.length} registros. ¿Quieres incorporarlos? Los registros actuales se conservarán.`)) return;
    const byId=new Map(records.map(r=>[r.id,r]));
    data.records.map(normalizeRecord).forEach(r=>byId.set(r.id,r));
    records=[...byId.values()];
    save(); render();
    alert("Respaldo recuperado correctamente.");
  } catch { alert("No se pudo leer el respaldo. Selecciona un archivo exportado desde Horas Extra."); }
  finally { event.target.value=""; }
});
render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}