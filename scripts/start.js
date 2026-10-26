const { spawnSync, spawn } = require("child_process");

function run(cmd, args) {
  console.log(`[ANTS] $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  return r.status === 0;
}

async function main() {
  const port = process.env.PORT || "8080";
  console.log(`[ANTS] boot start, PORT=${port}`);

  run("npx", ["prisma", "db", "push", "--skip-generate"]);

  console.log("[ANTS] seeding...");
  const seedOk = run("node", ["prisma/seed.js"]);
  if (!seedOk) console.log("[ANTS] seed skipped/failed (non-fatal)");

  console.log(`[ANTS] starting Next.js on 0.0.0.0:${port}`);
  const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", String(port)], {
    stdio: "inherit",
    env: process.env,
  });

  const cronSecret = process.env.CRON_SECRET || "ants-cron";
  const tick = () => {
    fetch(`http://127.0.0.1:${port}/api/cron/sweep`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch((err) => console.log("[ANTS] cron sweep skip", err?.message || err));
  };
  setTimeout(tick, 15000);
  setInterval(tick, 60000);

  child.on("exit", (code) => {
    console.log(`[ANTS] next exited with code ${code}`);
    process.exit(code || 0);
  });
}

main().catch((e) => {
  console.error("[ANTS] fatal", e);
  process.exit(1);
});
