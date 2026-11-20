const STORAGE_KEY = "horas-extra-registros-v1";
const $ = (id) => document.getElementById(id);
const monthPicker = $("monthPicker");
const workDate = $("workDate");
const dateDay = $("dateDay");
const dateMonth = $("dateMonth");
const dateYear = $("dateYear");
const form = $("entryForm");
const entriesEl = $("entries");
const errorEl = $("formError");
let records = loadRecords();

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
function monthString(date = new Date()) { return localDateString(date).slice(0,7); }
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function updateHiddenDate() {
  workDate.value = `${dateYear.value}-${dateMonth.value}-${dateDay.value}`;
}
function refreshDayOptions(preferredDay) {
  const year = Number(dateYear.value);
  const month = Number(dateMonth.value);
  const maxDay = daysInMonth(year, month);
  const selectedDay = Math.min(Number(preferredDay || dateDay.value || 1), maxDay);
  dateDay.innerHTML = Array.from({length:maxDay}, (_,i) => {
    const day = i + 1;
    return `<option value="${String(day).padStart(2,"0")}">${String(day).padStart(2,"0")}</option>`;
  }).join("");
  dateDay.value = String(selectedDay).padStart(2,"0");
  updateHiddenDate();
}
function setDateSelector(value) {
  const [year,month,day] = value.split("-");
  const currentYear = new Date().getFullYear();
  const years = new Set(Array.from({length:11},(_,i)=>String(currentYear-5+i)));
  years.add(year);
  dateYear.innerHTML = [...years].sort().map(y=>`<option value="${y}">${y}</option>`).join("");
  dateYear.value = year;
  dateMonth.value = month;
  refreshDayOptions(Number(day));
}
function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(validRecord) : [];
  } catch { return []; }
}
function validRecord(r) {
  return r && typeof r.id==="string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(r.start) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(r.end) &&
    Number.isInteger(r.minutes) && r.minutes>0 && r.minutes<1440;
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
  const match = String(value).trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]), minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}`;
}
function formatTimeInput(input) {
  input.value = input.value.replace(/\D/g,"").slice(0,4);
}
function prepareTimeInput(input) {
  input.value = input.value.replace(/\D/g,"").slice(0,4);
}
function finishTimeInput(input) {
  const parsed = parseTime(input.value);
  if (parsed) input.value = parsed;
}
function duration(start,end) {
  const [sh,sm]=start.split(":").map(Number);
  const [eh,em]=end.split(":").map(Number);
  return eh*60+em-(sh*60+sm);
}
function formatMinutes(total) {
  return `${Math.floor(total/60)} h ${String(total%60).padStart(2,"0")} min`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function render() {
  const month = monthPicker.value;
  const visible = records.filter(r=>r.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start));
  const total = visible.reduce((sum,r)=>sum+r.minutes,0);
  $("grandTotal").textContent = formatMinutes(total);
  $("entryCount").textContent = `${visible.length} ${visible.length===1?"registro":"registros"}`;
  if (!visible.length) {
    entriesEl.innerHTML = '<p class="empty">Todavía no hay jornadas registradas en este mes.</p>';
    return;
  }
  entriesEl.innerHTML = visible.map(r=>`
    <article class="entry">
      <div><div class="entry-date">${escapeHtml(r.date.split("-").reverse().join("-"))}</div>
      <div class="entry-times">${escapeHtml(r.start)} a ${escapeHtml(r.end)}</div></div>
      <div class="entry-duration">${formatMinutes(r.minutes)}</div>
      <button class="delete" type="button" data-delete="${escapeHtml(r.id)}" aria-label="Eliminar registro">Eliminar registro</button>
    </article>`).join("");
}
dateDay.addEventListener("change", updateHiddenDate);
dateMonth.addEventListener("change", () => refreshDayOptions(dateDay.value));
dateYear.addEventListener("change", () => refreshDayOptions(dateDay.value));
["startTime","endTime"].forEach(id=>{
  const input=$(id);
  input.addEventListener("focus",()=>prepareTimeInput(input));
  input.addEventListener("input",()=>formatTimeInput(input));
  input.addEventListener("blur",()=>finishTimeInput(input));
});
form.addEventListener("submit", (event)=>{
  event.preventDefault();
  errorEl.textContent="";
  const date=workDate.value, start=parseTime($("startTime").value), end=parseTime($("endTime").value);
  if (!date||!start||!end) { errorEl.textContent="Completa la fecha y escribe horarios válidos, por ejemplo 1730."; return; }
  const mins=duration(start,end);
  if (mins<=0) { errorEl.textContent="La hora de término debe ser posterior a la de inicio. Revisa los horarios."; return; }
  if (mins>=12*60) { errorEl.textContent="La duración supera 12 horas. Revisa que los horarios estén correctos."; return; }
  records.push({id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,date,start,end,minutes:mins});
  save();
  monthPicker.value=date.slice(0,7);
  $("startTime").value="";
  $("endTime").value="";
  render();
});
entriesEl.addEventListener("click",(event)=>{
  const button=event.target.closest("[data-delete]");
  if (!button) return;
  const record=records.find(r=>r.id===button.dataset.delete);
  if (!record || !confirm(`¿Eliminar el registro del ${record.date.split("-").reverse().join("-")}, ${record.start} a ${record.end}?`)) return;
  records=records.filter(r=>r.id!==record.id);
  save(); render();
});
monthPicker.addEventListener("change",render);
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({app:"Horas Extra",version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=`respaldo-horas-extra-${localDateString()}.json`; a.click();
  URL.revokeObjectURL(url);
});
$("importFile").addEventListener("change",async(event)=>{
  const file=event.target.files[0]; if(!file)return;
  try {
    const data=JSON.parse(await file.text());
    if(!data||!Array.isArray(data.records)||!data.records.every(validRecord)) throw new Error("Formato inválido");
    if(!confirm(`El respaldo contiene ${data.records.length} registros. ¿Quieres incorporarlos? Los registros actuales se conservarán.`)) return;
    const byId=new Map(records.map(r=>[r.id,r]));
    data.records.forEach(r=>byId.set(r.id,r));
    records=[...byId.values()]; save(); render();
    alert("Respaldo recuperado correctamente.");
  } catch { alert("No se pudo leer el respaldo. Selecciona un archivo exportado desde Horas Extra."); }
  finally { event.target.value=""; }
});
monthPicker.value=monthString();
setDateSelector(localDateString());
render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}