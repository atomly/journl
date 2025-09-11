import { env } from "~/env";

/**
 * Configure CORS headers based on environment.
 */
export function setCorsHeaders(res: Response) {
  // Set allowed origin based on environment.
  if (env.NODE_ENV === "development") {
    res.headers.set("Access-Control-Allow-Origin", "http://localhost:3000");
  } else if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    res.headers.set("Access-Control-Allow-Origin", `https://${env.VERCEL_URL}`);
  } else if (
    env.VERCEL_ENV === "production" &&
    env.VERCEL_PROJECT_PRODUCTION_URL
  ) {
    res.headers.set(
      "Access-Control-Allow-Origin",
      `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
    );
  } else if (env.PUBLIC_WEB_URL) {
    res.headers.set("Access-Control-Allow-Origin", env.PUBLIC_WEB_URL);
  }

  // Only allow the methods this endpoint uses.
  res.headers.set("Access-Control-Allow-Methods", "OPTIONS, GET, POST");

  // Only allow the headers that are needed.
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
}

export function handler() {
  const response = new Response(null, {
    status: 204,
  });
  setCorsHeaders(response);
  return response;
}
