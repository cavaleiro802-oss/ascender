import { existsSync, readdirSync } from "fs";
import { execSync } from "child_process";
import path from "path";

console.log("\n========== DIAGNÓSTICO ASCENDER ==========\n");

// 1. Variáveis de ambiente
const vars = ["NODE_ENV", "DATABASE_URL", "GOOGLE_CLIENT_ID", "SESSION_SECRET", 
               "SITE_URL", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
               "R2_BUCKET_NAME", "R2_PUBLIC_URL", "R2_ACCOUNT_ID", "PORT"];
console.log("── Variáveis de ambiente ──");
for (const v of vars) {
  const val = process.env[v];
  console.log(`${val ? "✅" : "❌"} ${v}: ${val ? (v.includes("SECRET") || v.includes("KEY") || v.includes("URL") ? "[definida]" : val) : "NÃO DEFINIDA"}`);
}

// 2. Arquivos críticos
console.log("\n── Arquivos críticos ──");
const files = [
  "package.json", "server/index.ts", "server/routers.ts", "server/db.ts",
  "drizzle/schema.ts", "nixpacks.toml", "vite.config.ts",
  "dist/client/index.html", "dist/client/assets",
];
for (const f of files) {
  console.log(`${existsSync(f) ? "✅" : "❌"} ${f}`);
}

// 3. Versões
console.log("\n── Versões ──");
try { console.log("Node:", process.version); } catch {}
try { console.log("npm:", execSync("npm --version").toString().trim()); } catch {}
try { console.log("tsx:", execSync("npx tsx --version 2>/dev/null").toString().trim()); } catch { console.log("tsx: não encontrado"); }
try { console.log("vite:", execSync("npx vite --version 2>/dev/null").toString().trim()); } catch { console.log("vite: não encontrado"); }

// 4. Conteúdo do dist
console.log("\n── Conteúdo do dist/ ──");
if (existsSync("dist")) {
  try {
    const list = execSync("find dist -type f").toString().trim();
    console.log(list || "(vazio)");
  } catch { console.log("erro ao listar dist"); }
} else {
  console.log("❌ pasta dist não existe!");
}

// 5. Scripts do package.json
console.log("\n── Scripts do package.json ──");
try {
  const pkg = JSON.parse(execSync("cat package.json").toString());
  for (const [k, v] of Object.entries(pkg.scripts || {})) {
    console.log(`  ${k}: ${v}`);
  }
} catch { console.log("erro ao ler package.json"); }

console.log("\n==========================================\n");
