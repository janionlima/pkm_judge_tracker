/* Formatação para exibição. */

/* ISO yyyy-mm-dd -> dd/mm/yyyy (ou vazio). */
export function fmtDate(iso) {
  if (!iso || typeof iso !== "string") return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
