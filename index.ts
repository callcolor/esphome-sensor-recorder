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
  name?: string;
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

  const establishNativeClientConnection = (host: string) => {
    // Connecting to native client to avoid device restarting every 15 minutes.
    // ESPHome issue discussion: https://github.com/esphome/feature-requests/issues/2694
    console.log("establishNativeClientConnection");

    const client = new Client({
      host,
      port: 6053,
      initializeSubscribeLogs: true,
    });

    client.connection.connect();
  };

  const connectEventSource = (host: string) => {
    // Server-side events.
    // https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
    console.log("connectEventSource");

    const evtSource = new EventSource(`http://${host}/events`);

    evtSource.addEventListener("state", async (event: DataEvent) => {
      console.log("state", event.data);
      if (event.data) {
        const data: SensorData = {
          name: null,
          ...JSON.parse(event.data),
          timestamp: new Date(),
        };
        if (data.id?.startsWith("sensor-")) {
          lastMessageAt = new Date().getTime();
          await sql`
            insert into state ${sql(
              data,
              "id",
              "name",
              "value",
              "state",
              "timestamp"
            )}
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });

    evtSource.onopen = (e) => {
      console.log("onopen", e);
    };

    evtSource.onerror = (e) => {
      console.log("onerror", e, e.message);
    };
  };

  if (process.env.FUSEBOXIP) {
    // Preset device IP.
    console.log("Device IP:", process.env.FUSEBOXIP);
    establishNativeClientConnection(process.env.FUSEBOXIP);
    connectEventSource(process.env.FUSEBOXIP);
  } else {
    // Discovery of device IP (mDNS).
    const discovery = new Discovery({});
    discovery.on("info", (deviceInfo) => {
      if (deviceInfo.friendly_name === "SeeedStudio-2CH-EM") {
        console.log("Device found:", deviceInfo);
        establishNativeClientConnection(deviceInfo.address);
        connectEventSource(deviceInfo.address);
      }
    });
    discovery.run();
  }
};

main();
