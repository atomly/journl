import { json } from "express";
import localtunnel from "localtunnel";
import { app } from "./app.ts";
import { env } from "./env.ts";
import { useNextjsProxy } from "./middleware/use-nextjs-proxy.ts";
import { usePayloadLogger } from "./middleware/use-payload-logger.ts";

/**
 * The tunnel proxy.
 */
const tunnel = await localtunnel({ port: env.LOCALTUNNEL_PORT });

// Parse JSON bodies.
app.use(json());

// Start the server, we'll proxy the requests to the Next.js server using the `useNextjsProxy` middleware.
app.listen(env.LOCALTUNNEL_PORT, () => {
	console.debug(`Tunnel server listening on port ${env.LOCALTUNNEL_PORT}!`);
});

// Small route for health checks, helps us know if the server is running.
app.get("/", (_req, res) => {
	res.send("Hello World");
});

usePayloadLogger(app);
useNextjsProxy(app);

// Close the tunnel when the process exits.
process.on("exit", () => tunnel.close());
