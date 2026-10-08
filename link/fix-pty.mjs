// node-pty's prebuilt spawn-helper ships without the execute bit on macOS,
// which makes every spawn fail with "posix_spawnp failed". Restore it.
import fs from "node:fs";
import path from "node:path";

const prebuilds = path.join(import.meta.dirname, "node_modules", "node-pty", "prebuilds");
if (fs.existsSync(prebuilds)) {
  for (const arch of fs.readdirSync(prebuilds)) {
    const helper = path.join(prebuilds, arch, "spawn-helper");
    if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
  }
}
