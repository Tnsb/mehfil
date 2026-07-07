import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** short, URL-safe id with a type prefix, e.g. "evt_k3j9x0q2m1" */
export function newId(prefix: string, length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}_${out}`;
}

export function newToken(): string {
  return randomBytes(32).toString("hex");
}
