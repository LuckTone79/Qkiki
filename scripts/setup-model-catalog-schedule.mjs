import { Client } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN?.trim();
if (!token) throw new Error("QSTASH_TOKEN is required.");
const client = new Client({ token, url: process.env.QSTASH_URL?.trim() || undefined });
const destination = "https://yapp.wideget.net/api/internal/model-catalog/sync";
const scheduleId = "yapp-production-daily-model-catalog";
const cron = "CRON_TZ=Asia/Seoul 0 4 * * *";

await client.schedules.create({ destination, scheduleId, cron, retries: 3, body: "{}" });
const schedule = (await client.schedules.list()).find((entry) => entry.scheduleId === scheduleId);
if (!schedule || schedule.destination !== destination || schedule.cron !== cron) {
  throw new Error("The model catalog schedule did not match the expected destination or time.");
}
console.log(JSON.stringify({ scheduleId, destination, cron }));
