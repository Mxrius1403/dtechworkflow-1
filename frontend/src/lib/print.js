import { DEPARTMENTS, departmentName } from "./cases";
import { dateKey, formatDuration, minutesBetween, nice, timeOf } from "./format";
import { notifyError } from "./notify";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const logo = () => `${window.location.origin}/brand/logo.png`;
const BASE_CSS = "body{font-family:Arial,sans-serif;color:#06164a;font-size:11px;padding:28px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0097a7;padding-bottom:14px;margin-bottom:16px}header img{width:190px}h1{margin:0}table{width:100%;border-collapse:collapse;margin:10px 0 16px}th{background:#06164a;color:#fff}td,th{padding:7px;border:1px solid #d8dee9;text-align:left}.late{color:#c2410c;font-weight:bold}.on{color:#15803d;font-weight:bold}.box{background:#f8fafc;border:1px solid #dbe4ee;border-radius:10px;padding:12px;margin:12px 0}footer{margin-top:24px;color:#64748b;text-align:center}";

const page = (title, heading, sub, body) =>
  `<!doctype html><html><head><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body><header><img src="${logo()}" alt="Dentaltech"><div style="text-align:right"><h1>${esc(heading)}</h1><b>${sub}</b></div></header>${body}<footer>Dentaltech Group • Daily Flow</footer></body></html>`;

const table = (headers, rows) => `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;

/** Print an HTML document through a hidden iframe (browser "Save as PDF"). */
export function printHtml(html) {
  try {
    const frame = document.createElement("iframe");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "1px", height: "1px", border: "0", opacity: "0" });
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    const run = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 3000);
    };
    const images = [...doc.images];
    if (!images.length) return setTimeout(run, 250);
    let pending = images.length;
    const ready = () => { pending -= 1; if (pending <= 0) setTimeout(run, 250); };
    images.forEach((img) => (img.complete ? ready() : (img.onload = img.onerror = ready)));
  } catch (err) {
    notifyError("Could not open the print window.");
  }
}

export function reportPdfHtml(r) {
  const insights = DEPARTMENTS.map((dep) => `<div class="box"><h2>${departmentName(dep)} — 5 Production Insights</h2><ol>${(r.departmentInsights?.[dep] || []).map((i) => `<li>${esc(i.text)}</li>`).join("")}</ol></div>`).join("");
  const techs = r.byTech.map((t) => `<h2>${esc(t.id)} — ${esc(t.name)}</h2>${table(
    ["Case", "Service Type", "Arch", "Date", "Started", "Completed", "Duration", "Status / Reason"],
    t.cases.map((c) => `<tr><td>${esc(c.code)}${c.code === "OW" ? ` — ${esc(c.activity || "Other Work")}` : ""}</td><td>${esc((c.serviceTypes || []).join(" + ") || "-")}</td><td>${esc(c.arch || "-")}</td><td>${esc(nice(c.finishedDate || dateKey(c.finishedAt)))}</td><td>${esc(c.startedTime || timeOf(c.startedAt))}</td><td>${esc(c.finishedTime || timeOf(c.finishedAt))}</td><td>${formatDuration(minutesBetween(c.startedAt, c.finishedAt))}</td><td class="${c.code === "OW" ? "" : c.overdue ? "late" : "on"}">${c.code === "OW" ? "Other Work" : c.overdue ? "Overdue" : "On Time"}${c.overdueReason ? ` — ${esc(c.overdueReason)}` : ""}</td></tr>`),
  )}<p><b>Total:</b> ${t.total} &nbsp; <b>Overdue:</b> ${t.overdue} &nbsp; <b>Average:</b> ${formatDuration(t.avgMinutes)}</p>`).join("");
  const kpis = `<div class="box"><b>Total services:</b> ${r.cases.length} &nbsp; <b>Completed:</b> ${r.completed.length} &nbsp; <b>Overdue:</b> ${r.overdue.length} &nbsp; <b>Average time:</b> ${formatDuration(r.avgAll)}</div>`;
  return page(`Production_Report_${r.from}_to_${r.to}`, "Production Report", `${nice(r.from)} to ${nice(r.to)}`, kpis + insights + techs);
}

export function toothOrderPdfHtml(o) {
  const meta = `<div class="box"><b>Technician:</b> ${esc(o.technician)} (${esc(o.technicianId)})<br><b>Date:</b> ${esc(o.date)} ${esc(o.time)}<br><b>Total:</b> ${o.total} teeth</div>`;
  return page(o.id, "Order Tooth", esc(o.id), meta + table(["Group", "Tooth", "Shade", "Quantity"], o.items.map((i) => `<tr><td>${esc(i.group)}</td><td>${esc(i.tooth)}</td><td>${esc(i.shade)}</td><td>${i.qty}</td></tr>`)));
}

export function materialOrderPdfHtml(o) {
  const meta = `<div class="box"><b>Requested by:</b> ${esc(o.requestedBy)} (${esc(o.requestedById)})<br><b>Department:</b> ${esc(departmentName(o.department))}<br><b>Date:</b> ${esc(o.date)} ${esc(o.time)}<br><b>Total quantity:</b> ${Number(o.totalItems || 0)}${o.notes ? `<br><b>Notes:</b> ${esc(o.notes)}` : ""}</div>`;
  return page(o.id, "TDS Material Order", esc(o.id), meta + table(["Code", "Description", "Brand", "Pack", "Qty"], (o.items || []).map((i) => `<tr><td>${esc(i.code)}</td><td>${esc(i.description)}</td><td>${esc(i.brand)}</td><td>${esc(i.pack)}</td><td>${Number(i.qty || 0)}</td></tr>`)));
}
