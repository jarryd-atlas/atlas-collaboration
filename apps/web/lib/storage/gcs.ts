/**
 * Google Cloud Storage client for Cloudflare Workers.
 *
 * Uses the GCS JSON API directly via fetch — no heavy Node.js SDK required.
 * Authenticates with a service account key (JWT → access token exchange).
 *
 * Required env var:
 *   GCS_SERVICE_ACCOUNT_JSON — full JSON key file contents
 *   GCS_BUCKET — bucket name (e.g. "atlas-collaborate-files")
 */

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

// Cache access token in module scope (survives within a single request on Workers)
let cachedToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccountKey {
  const json = process.env.GCS_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error("Missing GCS_SERVICE_ACCOUNT_JSON env var");
  return JSON.parse(json);
}

function getBucket(): string {
  const bucket = process.env.GCS_BUCKET;
  if (!bucket) throw new Error("Missing GCS_BUCKET env var");
  return bucket;
}

/**
 * Import a PEM-encoded RSA private key for use with Web Crypto API.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM header/footer and decode base64
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

/**
 * Create a signed JWT for Google OAuth2 service account auth.
 */
async function createSignedJwt(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.full_control",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600, // 1 hour
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${sigB64}`;
}

/**
 * Get an access token via service account JWT assertion.
 * Caches for reuse within the token's lifetime.
 */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const sa = getServiceAccount();
  const jwt = await createSignedJwt(sa);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCS auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Upload a file to GCS.
 */
export async function uploadFile(
  path: string,
  data: Uint8Array | ArrayBuffer,
  contentType: string,
): Promise<void> {
  const bucket = getBucket();
  const token = await getAccessToken();

  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: data instanceof ArrayBuffer ? new Uint8Array(data) as unknown as BodyInit : data as unknown as BodyInit,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCS upload failed (${res.status}): ${text}`);
  }
}

/**
 * Delete a file from GCS.
 */
export async function deleteFile(path: string): Promise<void> {
  const bucket = getBucket();
  const token = await getAccessToken();

  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  // 404 is ok — file already gone
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`GCS delete failed (${res.status}): ${text}`);
  }
}

/**
 * Generate a V4 signed URL for reading a file.
 * Uses the GCS signBlob API so we don't need local crypto for signing.
 */
export async function getSignedUrl(
  path: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const sa = getServiceAccount();
  const bucket = getBucket();
  const token = await getAccessToken();

  const now = new Date();
  const datestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const credentialScope = `${datestamp.slice(0, 8)}//storage/goog4_request`;
  const credential = `${sa.client_email}/${credentialScope}`;

  const canonicalHeaders = `host:storage.googleapis.com\n`;
  const signedHeaders = "host";

  const canonicalQueryString = new URLSearchParams({
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": credential,
    "X-Goog-Date": datestamp,
    "X-Goog-Expires": String(expiresInSeconds),
    "X-Goog-SignedHeaders": signedHeaders,
  })
    .toString()
    .replace(/\+/g, "%20");

  const canonicalRequest = [
    "GET",
    `/${bucket}/${path}`,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "GOOG4-RSA-SHA256",
    datestamp,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  // Sign with the private key
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(stringToSign),
  );
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `https://storage.googleapis.com/${bucket}/${path}?${canonicalQueryString}&X-Goog-Signature=${sigHex}`;
}

/**
 * Get a public URL for a file. Requires the object (or bucket) to have public read access.
 * For private files, use getSignedUrl instead.
 */
export function getPublicUrl(path: string): string {
  const bucket = getBucket();
  return `https://storage.googleapis.com/${bucket}/${path}`;
}

/**
 * Download a file from GCS as an ArrayBuffer.
 * Used for AI document analysis pipeline.
 */
export async function downloadFile(path: string): Promise<ArrayBuffer> {
  const bucket = getBucket();
  const token = await getAccessToken();

  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCS download failed (${res.status}): ${text}`);
  }

  return res.arrayBuffer();
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
