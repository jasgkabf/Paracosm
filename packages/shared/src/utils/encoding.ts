export function base64Encode(data: string): string {
  return Buffer.from(data, 'utf8').toString('base64');
}

export function base64Decode(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf8');
}

export function urlEncode(data: string): string {
  return encodeURIComponent(data);
}

export function urlDecode(encoded: string): string {
  return decodeURIComponent(encoded);
}

export function hexEncode(data: string): string {
  return Buffer.from(data, 'utf8').toString('hex');
}

export function hexDecode(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}
