// Thin typed fetch wrapper over the `/api` REST base (AD-1, AD-4, AD-5).
//
// Responsibilities:
//   - resolve the API base URL (VITE_API_BASE_URL, default "/api" for the
//     single-origin composed stack, AD-10);
//   - issue JSON requests;
//   - parse the ONE AD-5 error envelope on any non-2xx and throw a typed
//     `ApiClientError`, so every caller/hook handles a single error shape.
//
// This is the only module that touches `fetch`. Components reach it exclusively
// through hooks (components → hooks → api client → HTTP; AD-2 dependency order).

import type { ApiErrorDetail, ApiErrorEnvelope } from '../types';

/** Base path for the backend REST API. */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * A normalized API failure. Carries the parsed AD-5 envelope fields when the
 * server produced one, plus the HTTP status. Network failures (fetch throwing)
 * and non-JSON error bodies surface here too with a synthetic `code`.
 */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(
    code: string,
    message: string,
    status: number,
    details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const err = (value as { error?: unknown }).error;
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

/**
 * Perform a JSON request against `${API_BASE_URL}${path}` and return the parsed
 * body typed as `T`. Throws `ApiClientError` on any non-2xx response or network
 * failure. A 204 (no content) resolves to `undefined`.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    // fetch rejects only on network-level failure (offline, DNS, CORS, etc.).
    throw new ApiClientError('network_error', 'Network request failed', 0);
  }

  if (!response.ok) {
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      // Non-JSON error body — fall through to a synthetic envelope.
    }
    if (isErrorEnvelope(body)) {
      throw new ApiClientError(
        body.error.code,
        body.error.message,
        response.status,
        body.error.details,
      );
    }
    throw new ApiClientError(
      'unexpected_error',
      `Request failed with status ${response.status}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
