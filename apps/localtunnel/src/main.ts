import { json } from "express";
import localtunnel from "localtunnel";
import { app } from "./app.ts";
import { env } from "./env.ts";
import { useNextjsProxy } from "./middleware/use-nextjs-proxy.ts";
import { usePayloadLogger } from "./middleware/use-payload-logger.ts";

function createTunnel() {
  return localtunnel({
    port: env.LOCALTUNNEL_PORT,
    subdomain: env.LOCALTUNNEL_SUBDOMAIN,
  });
}

async function setupTunnel() {
  const tunnel = await createTunnel();

  console.debug(`Tunnel ready at: ${tunnel.url}`);

  tunnel.on("close", () => {
    console.warn("Tunnel closed, attempting to reconnect...");
    setTimeout(() => {
      setupTunnel().catch((error) => {
        console.error("Failed to reconnect tunnel:", error);
      });
    }, 1000);
  });

  tunnel.on("error", (error) => {
    console.error("Tunnel error:", error);
  });

  return tunnel;
}

const tunnel = await setupTunnel();

app.use(json());

app.listen(env.LOCALTUNNEL_PORT, () => {
  console.debug(`Tunnel server listening on port ${env.LOCALTUNNEL_PORT}!`);
});

app.get("/", (_req, res) => {
  res.send("Hello World");
});

usePayloadLogger(app);
useNextjsProxy(app);

process.on("exit", () => tunnel.close());
process.on("SIGINT", () => {
  tunnel.close();
  process.exit();
});
process.on("SIGTERM", () => {
  tunnel.close();
  process.exit();
});
