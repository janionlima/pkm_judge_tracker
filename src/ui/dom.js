/*
 * Utilitários de UI compartilhados: criação de elementos, escape de HTML,
 * toast, bottom sheet e marcação de campos inválidos.
 */

export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/* ---------- Toast ---------- */
let toastEl;
let toastTimer;
export function toast(msg) {
  if (!toastEl) {
    toastEl = el('<div class="toast" role="status" aria-live="polite"></div>');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

/* ---------- Bottom sheet ---------- */
let sheetEl;
let backdropEl;

function ensureSheet() {
  if (sheetEl) return;
  backdropEl = el('<div class="sheet-backdrop"></div>');
  sheetEl = el('<div class="sheet" role="dialog" aria-modal="true"></div>');
  document.body.appendChild(backdropEl);
  document.body.appendChild(sheetEl);
  backdropEl.addEventListener("click", closeSheet);
}

export function openSheet(html) {
  ensureSheet();
  sheetEl.innerHTML = html;
  backdropEl.classList.add("show");
  requestAnimationFrame(() => sheetEl.classList.add("show"));
  return sheetEl;
}

export function closeSheet() {
  if (!sheetEl) return;
  sheetEl.classList.remove("show");
  backdropEl.classList.remove("show");
  setTimeout(() => {
    if (sheetEl) sheetEl.innerHTML = "";
  }, 250);
}

/* Confirmação reutilizável via sheet. */
export function confirmSheet(title, message, onConfirm) {
  const sheet = openSheet(`
    <h3>${esc(title)}</h3>
    ${message ? `<p style="color:var(--muted);font-size:14px;margin-top:0">${esc(message)}</p>` : ""}
    <div class="btn-row">
      <button class="btn ghost" data-act="cancel">Cancelar</button>
      <button class="btn danger" data-act="ok">Confirmar</button>
    </div>
  `);
  sheet.querySelector('[data-act="cancel"]').addEventListener("click", closeSheet);
  sheet.querySelector('[data-act="ok"]').addEventListener("click", () => onConfirm());
}

/* ---------- Validação visual ---------- */

/*
 * Aplica a lista de erros ({field, message}) ao formulário, marcando os campos
 * [data-f="<field>"] como inválidos e preenchendo o .error correspondente.
 * Retorna o primeiro campo inválido (para foco).
 */
export function applyErrors(formEl, errors) {
  // Limpa estado anterior.
  formEl.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  let first = null;
  for (const e of errors) {
    const field = formEl.querySelector(`[data-f="${e.field}"]`);
    if (!field) continue;
    field.classList.add("invalid");
    const errBox = field.querySelector(".error");
    if (errBox && e.message) errBox.textContent = e.message;
    if (!first) first = field;
  }
  return first;
}

export function clearErrors(formEl) {
  formEl.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
}
