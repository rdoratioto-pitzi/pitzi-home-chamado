const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Hash a password using PBKDF2-SHA256.
 * Returns: "pbkdf2:iterations:salt_hex:hash_hex"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufferToHex(salt.buffer)}:${bufferToHex(hash)}`;
}

/**
 * Verify a password against a PBKDF2 hash.
 * Also supports plaintext comparison for lazy migration.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  // PBKDF2 hashed password
  if (stored.startsWith("pbkdf2:")) {
    const [, iterStr, saltHex, hashHex] = stored.split(":");
    const iterations = parseInt(iterStr, 10);
    const salt = new Uint8Array(hexToBuffer(saltHex));
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const derivedHash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      KEY_LENGTH * 8,
    );
    const storedHash = new Uint8Array(hexToBuffer(hashHex));
    const derivedArray = new Uint8Array(derivedHash);
    if (storedHash.length !== derivedArray.length) {
      return { valid: false, needsRehash: false };
    }
    let diff = 0;
    for (let i = 0; i < storedHash.length; i++) {
      diff |= storedHash[i] ^ derivedArray[i];
    }
    return { valid: diff === 0, needsRehash: false };
  }

  // Plaintext password (legacy — lazy migration)
  const valid = password === stored;
  return { valid, needsRehash: valid };
}

/**
 * SHA-256 hash for refresh token storage.
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bufferToHex(hash);
}
