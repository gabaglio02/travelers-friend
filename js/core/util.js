/* Funções utilitárias puras (texto, datas, horários, distâncias, idade). */
import { AGE_OPTIONS, WEEKDAYS, MAX_DAYS } from "./constantes.js";

export const $ = (sel) => document.querySelector(sel);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = (v) => v === 0 ? "Grátis" : "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const moneyExact = (v) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const toHHMM = (min) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  return String(h).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
};
export const fmtDur = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return m + "min";
  return h + "h" + (m ? String(m).padStart(2, "0") : "");
};
export function parseDur(text) {
  const t = String(text).trim().toLowerCase().replace(/\s/g, "");
  let m;
  if ((m = t.match(/^(\d+)h(\d{0,2})(min)?$/))) return +m[1] * 60 + (+m[2] || 0);
  if ((m = t.match(/^(\d+):(\d{1,2})$/))) return +m[1] * 60 + +m[2];
  if ((m = t.match(/^(\d+)(min|m)?$/))) return +m[1];
  return null;
}

export const parseISO = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const toISO = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const fmtDay = (iso) => { const d = parseISO(iso); return WEEKDAYS[d.getDay()] + ", " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };
export const fmtShort = (iso) => { const d = parseISO(iso); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); };

export function dateRange(start, end) {
  const out = [];
  if (!start || !end) return out;
  const d = parseISO(start), last = parseISO(end);
  while (d <= last && out.length < MAX_DAYS) { out.push(toISO(d)); d.setDate(d.getDate() + 1); }
  return out;
}

export const ageMin = (idade) => idade === "Livre" ? 0 : parseInt(idade, 10) || 0;
export function bracketFor(age) { return AGE_OPTIONS.reduce((acc, o) => (o.v <= age ? o.v : acc), 0); }
export const ciIcon = (v, cls = "") => `<span class="ci ci-${v} ${cls}" title="${esc(AGE_OPTIONS.find((o) => o.v === v)?.desc || "")}">${v === 0 ? "L" : v}</span>`;
export const ageBadge = (idade) => ciIcon(ageMin(idade));
// Lugares da região metropolitana mostram o município; os da capital, o bairro.
export const placeLabel = (p) => p.municipio ? p.municipio + " · Grande SP" : p.bairro;

export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const walkMinutes = (km) => Math.max(1, Math.round(km * 1.25 / 4.8 * 60));
