import { EventSource } from "undici";
import { Client, Discovery } from "@2colors/esphome-native-api";
import postgres from "postgres";
import dotenv from "dotenv";
import { SECONDS } from "./constants";

dotenv.config();

const TIMEOUT = 60 * SECONDS;

interface DataEvent extends Event {
  data?: string;
}

interface SensorData {
  id?: string;
  value: number;
  state: string;
  timestamp: Date;
}

const sql = postgres();

const main = async () => {
  let lastMessageAt = new Date().getTime();
  setInterval(() => {
    if (new Date().getTime() - lastMessageAt > TIMEOUT) {
      throw new Error("Timeout exceeded.");
    }
  }, 1 * SECONDS);
  const discovery = new Discovery({});

  discovery.on("info", (deviceInfo) => {
    if (deviceInfo.friendly_name === "SeeedStudio-2CH-EM") {
      {
        // Connecting to native client to avoid device restarting every 15 minutes.
        // ESPHome issue discussion: https://github.com/esphome/feature-requests/issues/2694
        const client = new Client({
          host: deviceInfo.address,
          port: 6053,
          initializeSubscribeLogs: true,
        });

        client.connection.connect();
      }

      const evtSource = new EventSource(`http://${deviceInfo.address}/events`);

      evtSource.addEventListener("state", async (event: DataEvent) => {
        console.log("state", event.data);
        if (event.data) {
          const data: SensorData = {
            ...JSON.parse(event.data),
            timestamp: new Date(),
          };
          if (data.id?.startsWith("sensor-")) {
            lastMessageAt = new Date().getTime();
            await sql`
              insert into state ${sql(
                data,
                "id",
                "value",
                "state",
                "timestamp"
              )}
            `;
          }
        }
      });

      evtSource.onerror = (e) => {
        console.log("onerror", e, e.message);
      };
    }
  });

  discovery.run();
};

main();
