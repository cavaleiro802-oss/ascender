import { existsSync } from "fs";
import { execSync } from "child_process";

console.log("\n========== DIAGNÓSTICO ASCENDER ==========\n");

// 1. Variáveis de ambiente
const vars = ["NODE_ENV", "DATABASE_URL", "MYSQLHOST", "MYSQLPORT", "MYSQLUSER", 
               "MYSQLPASSWORD", "MYSQLDATABASE", "GOOGLE_CLIENT_ID", "SESSION_SECRET", 
               "SITE_URL", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
               "R2_BUCKET_NAME", "R2_PUBLIC_URL", "R2_ACCOUNT_ID", "PORT"];
console.log("── Variáveis de ambiente ──");
for (const v of vars) {
  const val = process.env[v];
  const ocultar = v.includes("SECRET") || v.includes("PASSWORD") || v.includes("KEY");
  console.log(`${val ? "✅" : "❌"} ${v}: ${val ? (ocultar ? "[definida]" : val) : "NÃO DEFINIDA"}`);
}

// 2. Conexão MySQL
console.log("\n── Conexão MySQL ──");
if (process.env.MYSQLHOST && process.env.MYSQLUSER) {
  console.log("✅ Usando variáveis separadas (MYSQLHOST, MYSQLUSER, etc.)");
} else if (process.env.DATABASE_URL) {
  console.log("⚠️  Usando DATABASE_URL (pode ter problema com root/IPv6)");
} else {
  console.log("❌ Nenhuma variável de banco definida!");
}

// 3. Arquivos críticos
console.log("\n── Arquivos críticos ──");
const files = [
  "package.json", "server/index.ts", "server/routers.ts", "server/db.ts",
  "drizzle/schema.ts", "nixpacks.toml", "vite.config.ts",
  "dist/client/index.html", "dist/client/assets",
];
for (const f of files) {
  console.log(`${existsSync(f) ? "✅" : "❌"} ${f}`);
}

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
