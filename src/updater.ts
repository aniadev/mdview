import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

export async function checkForUpdate(opts: { silent: boolean } = { silent: true }) {
  try {
    const update = await check();
    if (!update) {
      if (!opts.silent) {
        await ask("You're on the latest version.", {
          title: "mdview update",
          kind: "info",
        });
      }
      return;
    }
    const proceed = await ask(
      `Version ${update.version} is available (current: ${update.currentVersion}).\n\nDownload and install now?`,
      { title: "mdview update", kind: "info", okLabel: "Install", cancelLabel: "Later" }
    );
    if (!proceed) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    console.error("update check failed", e);
    if (!opts.silent) {
      await ask(`Update check failed: ${String(e)}`, {
        title: "mdview update",
        kind: "warning",
      });
    }
  }
}
