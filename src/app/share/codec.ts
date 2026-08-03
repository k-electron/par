/**
 * Encoding a played game into a link, and back.
 *
 * Two jobs pull against each other. The link has to reconstruct exactly what
 * somebody did, and it has to spoil nothing for a person who merely glances at
 * it — chat clients unfurl URLs, and nobody should learn today's answer from a
 * preview in a group thread.
 *
 * So the payload is opaque. **This is spoiler-prevention, not security**, and it
 * is treated as such: there is no signing, no cryptography, and no attempt to
 * stop a determined reader. A determined reader can open the page source and
 * read the whole word list. What matters is that the URL text carries no
 * readable word, and that a corrupted one fails cleanly instead of showing a
 * confidently wrong score.
 *
 * The answer is never encoded. It is derived from the day, which is the same
 * derivation the sender's browser did, so the payload only has to carry the
 * day, the two settings and the guesses.
 */

const CODEC_VERSION = 1;

/** Bits per guess index. 14 bits covers 16,384, comfortably over the 12,972. */
const GUESS_BITS = 14;
/** Bits for the day number. 20 covers about 2,800 years from the epoch. */
const DAY_BITS = 20;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export interface SharedGame {
  readonly puzzleNumber: number;
  readonly hardMode: boolean;
  readonly tookHouseStarter: boolean;
  /** Indices into the guess dictionary, in the order they were played. */
  readonly guessIndices: readonly number[];
  /** The word-list version the sender played against. */
  readonly wordListVersion: string;
}

export type DecodeFailure =
  | { readonly kind: 'malformed' }
  | { readonly kind: 'unsupported-version'; readonly version: number };

export type DecodeResult =
  | { readonly ok: true; readonly game: SharedGame }
  | { readonly ok: false; readonly failure: DecodeFailure };

class BitWriter {
  private bits: number[] = [];

  write(value: number, width: number): void {
    for (let shift = width - 1; shift >= 0; shift -= 1) {
      this.bits.push((value >>> shift) & 1);
    }
  }

  toBytes(): number[] {
    const bytes: number[] = [];
    for (let index = 0; index < this.bits.length; index += 8) {
      let byte = 0;
      for (let offset = 0; offset < 8; offset += 1) {
        byte = (byte << 1) | (this.bits[index + offset] ?? 0);
      }
      bytes.push(byte);
    }
    return bytes;
  }
}

class BitReader {
  private position = 0;
  private readonly bytes: readonly number[];

  constructor(bytes: readonly number[]) {
    this.bytes = bytes;
  }

  read(width: number): number {
    let value = 0;
    for (let index = 0; index < width; index += 1) {
      const bit = this.position >>> 3 < this.bytes.length
        ? (this.bytes[this.position >>> 3]! >>> (7 - (this.position & 7))) & 1
        : 0;
      value = (value << 1) | bit;
      this.position += 1;
    }
    return value;
  }

  get exhausted(): boolean {
    return this.position >= this.bytes.length * 8;
  }
}

/**
 * A short checksum over the payload.
 *
 * There to catch a truncated or mistyped link so it can fail gracefully, which
 * is all §7 asks for. It is not a signature and would not stop anyone forging a
 * payload — nobody is trying to.
 */
function checksum(bytes: readonly number[]): number {
  let hash = 0x811c;
  for (const byte of bytes) {
    hash = (hash ^ byte) & 0xffff;
    hash = (hash * 0x0193) & 0xffff;
  }
  return hash & 0xff;
}

/**
 * Mask the bytes so the encoding is not obvious at a glance.
 *
 * A keystream from a fixed constant and the payload length. Deliberately
 * trivial: its whole job is to stop the base64 looking like structured data in
 * a chat preview, and dressing it up as real encryption would imply a threat
 * model this project does not have.
 */
function mask(bytes: readonly number[]): number[] {
  let state = (0x9e37 ^ (bytes.length * 0x0101)) & 0xffff;
  return bytes.map((byte) => {
    state = (state * 0x6d2b + 0x9e37) & 0xffff;
    return byte ^ ((state >>> 5) & 0xff);
  });
}

function toBase64Url(bytes: readonly number[]): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]!;
    const b = bytes[index + 1];
    const c = bytes[index + 2];

    out += ALPHABET[a >>> 2]!;
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >>> 4)]!;
    if (b === undefined) break;
    out += ALPHABET[((b & 15) << 2) | ((c ?? 0) >>> 6)]!;
    if (c === undefined) break;
    out += ALPHABET[c & 63]!;
  }
  return out;
}

function fromBase64Url(text: string): number[] | null {
  const values: number[] = [];
  for (const character of text) {
    const value = ALPHABET.indexOf(character);
    if (value < 0) return null;
    values.push(value);
  }

  const bytes: number[] = [];
  for (let index = 0; index < values.length; index += 4) {
    const a = values[index]!;
    const b = values[index + 1];
    if (b === undefined) break;
    bytes.push(((a << 2) | (b >>> 4)) & 0xff);

    const c = values[index + 2];
    if (c === undefined) break;
    bytes.push(((b << 4) | (c >>> 2)) & 0xff);

    const d = values[index + 3];
    if (d === undefined) break;
    bytes.push(((c << 6) | d) & 0xff);
  }
  return bytes;
}

/** Six characters of the word-list version travel with the payload. */
const VERSION_CHARS = 6;

export function encodeSharedGame(game: SharedGame): string {
  if (game.guessIndices.length === 0 || game.guessIndices.length > 6) {
    throw new RangeError(`A shared game has one to six guesses, not ${game.guessIndices.length}.`);
  }
  if (game.puzzleNumber < 0 || game.puzzleNumber >= 2 ** DAY_BITS) {
    throw new RangeError(`Puzzle number ${game.puzzleNumber} is outside the encodable range.`);
  }

  const writer = new BitWriter();
  writer.write(CODEC_VERSION, 4);
  writer.write(game.puzzleNumber, DAY_BITS);
  writer.write(game.hardMode ? 1 : 0, 1);
  writer.write(game.tookHouseStarter ? 1 : 0, 1);
  writer.write(game.guessIndices.length, 3);
  for (const index of game.guessIndices) {
    writer.write(index, GUESS_BITS);
  }

  const body = writer.toBytes();
  const payload = [...body, checksum(body)];
  return game.wordListVersion.slice(0, VERSION_CHARS) + toBase64Url(mask(payload));
}

export function decodeSharedGame(text: string): DecodeResult {
  const malformed: DecodeResult = { ok: false, failure: { kind: 'malformed' } };

  if (text.length <= VERSION_CHARS) return malformed;

  const wordListVersion = text.slice(0, VERSION_CHARS);
  const masked = fromBase64Url(text.slice(VERSION_CHARS));
  if (masked === null || masked.length < 2) return malformed;

  const payload = mask(masked);
  const body = payload.slice(0, -1);
  if (checksum(body) !== payload.at(-1)) return malformed;

  const reader = new BitReader(body);
  const version = reader.read(4);
  if (version !== CODEC_VERSION) {
    return { ok: false, failure: { kind: 'unsupported-version', version } };
  }

  const puzzleNumber = reader.read(DAY_BITS);
  const hardMode = reader.read(1) === 1;
  const tookHouseStarter = reader.read(1) === 1;
  const count = reader.read(3);
  if (count < 1 || count > 6) return malformed;

  const guessIndices: number[] = [];
  for (let index = 0; index < count; index += 1) {
    guessIndices.push(reader.read(GUESS_BITS));
  }

  return {
    ok: true,
    game: { puzzleNumber, hardMode, tookHouseStarter, guessIndices, wordListVersion },
  };
}
