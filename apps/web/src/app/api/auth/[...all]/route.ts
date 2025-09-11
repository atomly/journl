import { toNextJsHandler } from "better-auth/next-js";
import { handler as corsHandler } from "~/app/api/_cors/cors";
import { auth } from "~/auth/server";

export const { POST, GET } = toNextJsHandler(auth);

export { corsHandler as OPTIONS };
