"use strict";
const { spawn } = require("node:child_process");
const path = require("node:path");
const pkg = path.join(__dirname, "vendor", "nicepay-start-api-mcp");
const entry = path.join(pkg, "dist", "index.js");
const child = spawn(process.execPath, [entry], {
  cwd: pkg,
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
