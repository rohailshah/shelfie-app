import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';

const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const devMemoryStore = new Map<string, string>();

interface SyncEnvelopeShape {
  version: number;
  updatedAt: string;
  revision: number;
  state: {
    progress: Record<string, unknown>;
    activeBoard: unknown[];
    shelf: Record<string, unknown>;
    [key: string]: unknown;
  };
}

function normalizeSyncCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isValidSyncCode(normalized: string): boolean {
  return /^[A-Z0-9]{12,32}$/.test(normalized);
}

function getBlobPathname(normalizedCode: string): string {
  const digest = createHash('sha256')
    .update(`shelfie-sync-v1:${normalizedCode}`)
    .digest('hex');
  return `sync/${digest}.json`;
}

function hasVercelBlobConfig(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function validateEnvelope(candidate: unknown): candidate is SyncEnvelopeShape {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return false;
  }
  const env = candidate as Partial<SyncEnvelopeShape>;
  if (
    env.version !== 1 ||
    typeof env.updatedAt !== 'string' ||
    typeof env.revision !== 'number' ||
    !Number.isFinite(env.revision) ||
    !env.state ||
    typeof env.state !== 'object' ||
    Array.isArray(env.state)
  ) {
    return false;
  }

  const s = env.state as Partial<SyncEnvelopeShape['state']>;
  if (
    !s.progress ||
    typeof s.progress !== 'object' ||
    Array.isArray(s.progress) ||
    !Array.isArray(s.activeBoard) ||
    !s.shelf ||
    typeof s.shelf !== 'object' ||
    Array.isArray(s.shelf)
  ) {
    return false;
  }

  return true;
}

export async function handleSyncRequest(params: {
  method: string;
  syncCode: string | undefined;
  bodyText?: string;
  parsedBody?: unknown;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const normalizedCode = normalizeSyncCode(params.syncCode ?? '');
  if (!isValidSyncCode(normalizedCode)) {
    return { status: 400, body: { error: 'Invalid sync code' } };
  }

  const pathname = getBlobPathname(normalizedCode);
  const method = params.method.toUpperCase();

  if (method === 'GET') {
    if (hasVercelBlobConfig()) {
      try {
        const result = await get(pathname, { access: 'private', useCache: false });
        if (!result || result.statusCode !== 200 || !result.stream) {
          return { status: 404, body: { exists: false } };
        }
        const text = await new Response(result.stream).text();
        const envelope = JSON.parse(text) as unknown;
        return { status: 200, body: { exists: true, envelope } };
      } catch (err) {
        const errName = err instanceof Error ? err.name : '';
        if (errName === 'BlobNotFoundError') {
          return { status: 404, body: { exists: false } };
        }
        throw err;
      }
    }

    const stored = devMemoryStore.get(pathname);
    if (!stored) {
      return { status: 404, body: { exists: false } };
    }
    return { status: 200, body: { exists: true, envelope: JSON.parse(stored) as unknown } };
  }

  if (method === 'PUT') {
    let rawJson: unknown = params.parsedBody;
    if (rawJson === undefined && typeof params.bodyText === 'string' && params.bodyText.trim()) {
      try {
        rawJson = JSON.parse(params.bodyText) as unknown;
      } catch {
        return { status: 400, body: { error: 'Invalid JSON body' } };
      }
    }

    const candidate =
      rawJson &&
      typeof rawJson === 'object' &&
      !Array.isArray(rawJson) &&
      'envelope' in rawJson
        ? (rawJson as { envelope?: unknown }).envelope
        : rawJson;

    if (!validateEnvelope(candidate)) {
      return { status: 400, body: { error: 'Malformed sync envelope' } };
    }

    const serialized = JSON.stringify(candidate);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
      return { status: 413, body: { error: 'Payload too large' } };
    }

    if (hasVercelBlobConfig()) {
      await put(pathname, serialized, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });
    } else {
      devMemoryStore.set(pathname, serialized);
    }

    return {
      status: 200,
      body: {
        ok: true,
        updatedAt: candidate.updatedAt,
        revision: candidate.revision,
      },
    };
  }

  return { status: 405, body: { error: 'Method not allowed' } };
}

async function readStreamText(req: AsyncIterable<Buffer | string>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(
  req: {
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    body?: unknown;
    [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>;
  },
  res: {
    status: (code: number) => { json: (body: unknown) => void };
    setHeader: (name: string, value: string) => void;
  }
) {
  res.setHeader('Cache-Control', 'no-store');

  const rawHeader = req.headers?.['x-shelfie-sync-code'];
  const syncCode = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const method = req.method ?? 'GET';

  try {
    let parsedBody: unknown = undefined;
    let bodyText: string | undefined = undefined;

    if (method.toUpperCase() === 'PUT') {
      if (typeof req.body === 'string') {
        bodyText = req.body;
      } else if (req.body && typeof req.body === 'object') {
        parsedBody = req.body;
      } else if (typeof req[Symbol.asyncIterator] === 'function') {
        bodyText = await readStreamText(req as AsyncIterable<Buffer | string>);
      }
    }

    const result = await handleSyncRequest({
      method,
      syncCode,
      bodyText,
      parsedBody,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    res.status(500).json({ error: message });
  }
}
