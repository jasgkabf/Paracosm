export function base64Encode(str: string): string {
  return Buffer.from(str, "utf8").toString("base64");
}

export function base64Decode(str: string): string {
  return Buffer.from(str, "base64").toString("utf8");
}

export function urlEncode(str: string): string {
  return encodeURIComponent(str);
}

export function urlDecode(str: string): string {
  return decodeURIComponent(str);
}

export function hexEncode(str: string): string {
  return Buffer.from(str, "utf8").toString("hex");
}

export function hexDecode(str: string): string {
  return Buffer.from(str, "hex").toString("utf8");
}

export function bufferToBase64(buf: Buffer): string {
  return buf.toString("base64");
}

export function base64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}
