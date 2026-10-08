import { sleep } from "workflow";

export async function runExploreRefresh(userId: string) {
  "use workflow";
  await sleep("5s");
  for (let attempt = 0; attempt < 24; attempt++) {
    const result = await refreshStep(userId);
    if (
      result === "published" ||
      result === "current" ||
      result === "superseded"
    )
      return result;
    await sleep(result === "busy" ? "30s" : "5s");
  }
  return "pending";
}
async function refreshStep(userId: string) {
  "use step";
  const { refreshExploreSnapshot } = await import("~/explore/snapshots");
  return refreshExploreSnapshot(userId);
}
export async function runExploreOutboxRecovery() {
  "use workflow";
  await recoverOutbox();
}
async function recoverOutbox() {
  "use step";
  const { recoverExploreOutbox } = await import("~/explore/dispatch");
  await recoverExploreOutbox();
}
