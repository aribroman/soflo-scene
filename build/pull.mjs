
import { collectLibraryEvents } from "./sources.mjs"; import fs from "node:fs";
const from = process.argv[2]; const days = +(process.argv[3]||30);
const branches = fs.existsSync(new URL("./branches.json", import.meta.url)) ? JSON.parse(fs.readFileSync(new URL("./branches.json", import.meta.url))) : {};
const r = await collectLibraryEvents({ from, days, branches });
fs.writeFileSync(new URL("./library-snapshot.json", import.meta.url), JSON.stringify(r));
console.log(JSON.stringify(r.status), r.events.length);
