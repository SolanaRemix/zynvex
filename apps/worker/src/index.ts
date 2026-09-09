import { prisma } from "@zynvex/database";
import { processQueueJob, runDueSchedules } from "../../../apps/web/src/lib/execution.ts";

const workerId = process.env.WORKER_ID ?? `worker-${globalThis.crypto.randomUUID().slice(0, 8)}`;
const intervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1_000);
const scheduleIntervalMs = Number(process.env.SCHEDULER_POLL_INTERVAL_MS ?? 30_000);

let shuttingDown = false;
let lastScheduleRun = 0;

async function tick() {
  if (shuttingDown) return;

  if (Date.now() - lastScheduleRun >= scheduleIntervalMs) {
    await runDueSchedules(workerId).catch((error) => {
      console.error(JSON.stringify({ level: "error", workerId, message: "Failed to run due schedules", error: error instanceof Error ? error.message : String(error) }));
    });
    lastScheduleRun = Date.now();
  }

  const job = await processQueueJob(workerId).catch((error) => {
    console.error(JSON.stringify({ level: "error", workerId, message: "Worker job failed", error: error instanceof Error ? error.message : String(error) }));
    return null;
  });

  if (job) {
    console.log(JSON.stringify({ level: "info", workerId, message: "Processed queue job", jobId: job.id, kind: job.kind }));
  }
}

async function start() {
  console.log(JSON.stringify({ level: "info", workerId, message: "Worker started", intervalMs, scheduleIntervalMs }));
  while (!shuttingDown) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function shutdown(signal: string) {
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", workerId, message: `Worker shutting down on ${signal}` }));
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
