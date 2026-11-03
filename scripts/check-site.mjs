#!/usr/bin/env node
/**
 * De controle van deze site: wat kapot kan zonder dat iemand het ziet.
 *
 * Geen afhankelijkheden, geen build. Voor elke pagina in site/:
 *   - <!doctype html>, <html lang="…"> en een <title>;
 *   - elke interne link en elk intern bestand (href/src, ook /x.html en
 *     css/…) bestaat in site/;
 *   - geen rijksregisternummer: de repo is publiek, en de LEESMIJ zegt al dat
 *     hier nooit persoonsgegevens van leden of hulpvragers horen.
 * En elke <loc> in site/sitemap.xml wijst naar een bestaande pagina.
 *
 * Deze controle is wat Brain laat bouwen: een voorstel mag haar nooit
 * aanpassen (config/repositories.json in project-brain-gateway weigert
 * scripts/check-site.mjs, .github/ en render.yaml).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const wortel = path.resolve(process.argv[2] ?? "site");
const fouten = [];

const paginas = [];
const loop = (map) => {
  for (const naam of readdirSync(map)) {
    const pad = path.join(map, naam);
    if (statSync(pad).isDirectory()) loop(pad);
    else if (naam.endsWith(".html")) paginas.push(pad);
  }
};
loop(wortel);
if (paginas.length === 0) fouten.push(`geen enkele .html in ${wortel}`);

/** Een interne verwijzing naar het bestand in site/ waar ze op uitkomt; null voor extern. */
const doelVan = (vanaf, ruw) => {
  const waarde = ruw.trim();
  if (!waarde || waarde.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(waarde) || waarde.startsWith("//")) return null; // http:, mailto:, tel:, data:
  const zonder = decodeURIComponent(waarde.split("#")[0].split("?")[0]);
  if (!zonder) return null;
  const doel = zonder.startsWith("/") ? path.join(wortel, zonder) : path.resolve(path.dirname(vanaf), zonder);
  return zonder.endsWith("/") ? path.join(doel, "index.html") : doel;
};

for (const pagina of paginas) {
  const naam = path.relative(wortel, pagina);
  const html = readFileSync(pagina, "utf8");
  if (!/^\s*<!doctype html>/i.test(html)) fouten.push(`${naam}: begint niet met <!doctype html>`);
  if (!/<html[^>]*\slang="[a-z-]+"/i.test(html)) fouten.push(`${naam}: <html> zonder lang`);
  if (!/<title>[^<]+<\/title>/i.test(html)) fouten.push(`${naam}: geen <title>`);
  for (const [, , ruw] of html.matchAll(/\b(href|src)="([^"]*)"/gi)) {
    const doel = doelVan(pagina, ruw);
    if (doel && !(existsSync(doel) && statSync(doel).isFile())) fouten.push(`${naam}: ${ruw} bestaat niet in site/`);
  }
  if (/\b\d{2}\.\d{2}\.\d{2}-\d{3}\.\d{2}\b/.test(html)) fouten.push(`${naam}: iets dat op een rijksregisternummer lijkt`);
}

const sitemap = path.join(wortel, "sitemap.xml");
if (existsSync(sitemap)) {
  for (const [, loc] of readFileSync(sitemap, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const pad = new URL(loc).pathname;
    const doel = pad.endsWith("/") ? path.join(wortel, pad, "index.html") : path.join(wortel, pad);
    if (!existsSync(doel)) fouten.push(`sitemap.xml: ${loc} bestaat niet in site/`);
  }
}

if (fouten.length) {
  for (const fout of fouten) console.error(`FOUT ${fout}`);
  process.exit(1);
}
console.log(`site in orde: ${paginas.length} pagina's nagekeken.`);
