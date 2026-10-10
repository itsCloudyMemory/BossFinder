// Consulta TibiaData (killstatistics de cada mundo) y actualiza data/history.json
// con la última fecha en que se vio morir a cada boss en cada mundo.
// Uso: node scripts/update.mjs

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.tibiadata.com/v4";

// Las stats que ves a las 23:30 (ART) reflejan el día anterior.
// Si resulta que reflejan el mismo día, poné 0.
const STATS_DAY_OFFSET = 1;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "tibia-boss-tracker" } });
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i === tries) throw err;
    }
    await sleep(1500 * i);
  }
  throw new Error(`Sin respuesta: ${url}`);
}

function artDate(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const d = new Date(parts + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

async function listWorlds() {
  const data = await getJson(`${API}/worlds`);
  const names = (data.worlds?.regular_worlds ?? []).map((x) => x.name).filter(Boolean);
  if (!names.length) throw new Error("No pude leer la lista de mundos");
  return names;
}

async function main() {
  const bosses = JSON.parse(await readFile(join(ROOT, "bosses.json"), "utf8"));
  const tracked = Object.entries(bosses).filter(([, b]) => b.source === "api");

  const historyPath = join(ROOT, "data", "history.json");
  let history = { updatedAt: null, statsDate: null, bosses: {} };
  try { history = JSON.parse(await readFile(historyPath, "utf8")); } catch {}
  history.bosses ??= {};

  const statsDate = artDate(STATS_DAY_OFFSET);
  const worlds = await listWorlds();
  console.log(`${worlds.length} mundos, stats del día ${statsDate}`);

  let failed = 0;
  const queue = [...worlds];
  const worker = async () => {
    while (queue.length) {
      const world = queue.shift();
      try {
        const data = await getJson(`${API}/killstatistics/${encodeURIComponent(world)}`);
        for (const e of data.killstatistics?.entries ?? []) {
          const race = e.race.toLowerCase();
          if (!(e.last_day_killed > 0)) continue;
          for (const [name, b] of tracked) {
            if (b.aliases.includes(race)) {
              (history.bosses[name] ??= {})[world] = statsDate;
              console.log(`  ${name} muerto en ${world} (${e.last_day_killed})`);
            }
          }
        }
      } catch (err) {
        failed++;
        console.warn(`  ! ${world}: ${err.message}`);
      }
      await sleep(250);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));

  history.updatedAt = new Date().toISOString();
  history.statsDate = statsDate;
  await mkdir(dirname(historyPath), { recursive: true });
  await writeFile(historyPath, JSON.stringify(history, null, 2) + "\n");
  console.log(`Listo. Fallaron ${failed} mundos.`);
  if (failed > worlds.length / 2) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
