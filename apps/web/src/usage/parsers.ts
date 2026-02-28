type UnknownRecord = Record<string, unknown>;

export type ErrorEnvelope = {
  code: string | null;
  message: string | null;
  payload: UnknownRecord | null;
};

export function parseErrorEnvelope(input: unknown): ErrorEnvelope {
  const payload = extractPayload(input);
  const payloadCode = payload ? asString(payload.code) : null;
  const payloadError = payload ? asString(payload.error) : null;
  const payloadMessage = payload ? asString(payload.message) : null;

  return {
    code: payloadCode ?? payloadError,
    message: payloadMessage ?? payloadError ?? readInputMessage(input),
    payload,
  };
}

function extractPayload(input: unknown, depth = 0): UnknownRecord | null {
  if (!input || depth > 3) {
    return null;
  }

  const record = asRecord(input);
  if (record) {
    return record;
  }

  if (typeof input === "string") {
    return parseJsonRecord(input);
  }

  if (input instanceof Error) {
    return (
      parseJsonRecord(input.message) ?? extractPayload(input.cause, depth + 1)
    );
  }

  return null;
}

function parseJsonRecord(value: string): UnknownRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function readInputMessage(input: unknown): string | null {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof Error) {
    return input.message;
  }

  return null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
