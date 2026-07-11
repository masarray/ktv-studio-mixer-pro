import { app } from "electron";

const checks = [
  ["node-hid", async () => {
    const imported = await import("node-hid");
    const HID = imported.default ?? imported;
    if (typeof HID.devices !== "function") throw new Error("HID.devices is unavailable");
    HID.devices();
  }],
  ["serialport", async () => {
    const imported = await import("serialport");
    if (typeof imported.SerialPort !== "function") throw new Error("SerialPort is unavailable");
  }],
];

await app.whenReady();
try {
  for (const [name, check] of checks) {
    process.stdout.write(`[native-check] ${name} ... `);
    await check();
    console.log("OK");
  }
  console.log("[native-check] All native modules work in Electron.");
  app.exit(0);
} catch (error) {
  console.error("FAILED");
  console.error(error?.stack ?? error);
  app.exit(1);
}
