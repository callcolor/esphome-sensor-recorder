Barebones script to save sensor data from Seeed Studio XIAO 2-Channel Wi-Fi AC Energy Meter.

The device is based on ESPHome https://esphome.io/index.html

https://www.seeedstudio.com/XIAO-2-Channel-Wi-Fi-AC-Energy-Meter-Bundle-Kit.html

https://wiki.seeedstudio.com/2_channel_wifi_ac_energy_meter/

```
-- Postgres schema

CREATE TABLE public.state (
id varchar NOT NULL,
value float4 NOT NULL,
state varchar NOT NULL,
"timestamp" timestamp NOT NULL,
CONSTRAINT state_pk PRIMARY KEY (id, "timestamp")
);

CREATE INDEX state_timestamp_idx ON public.state USING btree ("timestamp");
```
