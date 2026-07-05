export function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0))) & 0xff;
}

export function checksumTwosComplement(body: readonly number[]): number {
  const sum = body.reduce((acc, b) => (acc + (b & 0xff)) & 0xff, 0);
  return (-sum) & 0xff;
}

export function buildFrame(bodyWithoutChecksum: readonly number[]): Uint8Array {
  const body = bodyWithoutChecksum.map(byte);
  const cs = checksumTwosComplement(body);
  return Uint8Array.from([0xaa, ...body, cs]);
}

export function hex(bytes: ArrayLike<number> | null | undefined): string {
  if (!bytes) return "";
  return Array.from(bytes, (b) => (b & 0xff).toString(16).toUpperCase().padStart(2, "0")).join(" ");
}

export function verifyK500Frame(frame: Uint8Array): boolean {
  if (frame.length < 4) return false;
  const head = frame[0];
  if (head !== 0xaa && head !== 0x55) return false;
  const sum = Array.from(frame.slice(1)).reduce((acc, b) => (acc + b) & 0xff, 0);
  return sum === 0;
}

const RSP_LABELS: Record<number, string> = { 0xe3: "STATUS", 0xbf: "READ", 0xfd: "WRITE-ACK" };

export function frameLabel(frame: Uint8Array): string {
  if (frame[0] === 0xaa) return `TX CMD 0x${(frame[2] ?? 0).toString(16).toUpperCase().padStart(2, "0")}`;
  if (frame[0] === 0x55) {
    const rsp = frame[3] ?? 0;
    const name = RSP_LABELS[rsp];
    return `RX RSP 0x${rsp.toString(16).toUpperCase().padStart(2, "0")}${name ? ` · ${name}` : ""}`;
  }
  return "RAW";
}
