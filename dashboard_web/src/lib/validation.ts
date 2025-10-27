// dashboard_web/src/lib/validation.ts
import type { RequestBody } from './types';

export function validateBody(body: unknown): { ok: true; value: RequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = body as any;
  if (typeof b.preguntaUsuario !== 'string' || b.preguntaUsuario.trim().length === 0) {
    return { ok: false, error: "Missing or invalid 'preguntaUsuario'" };
  }
  if (!b.ubicacionUsuario || typeof b.ubicacionUsuario !== 'object') {
    return { ok: false, error: "Missing or invalid 'ubicacionUsuario'" };
  }
  const lat = Number(b.ubicacionUsuario.lat);
  const lng = Number(b.ubicacionUsuario.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "ubicacionUsuario must include numeric 'lat' and 'lng'" };
  }
  // normalize
  return { ok: true, value: { preguntaUsuario: b.preguntaUsuario.trim(), ubicacionUsuario: { lat, lng } } };
}
