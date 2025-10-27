// dashboard_web/src/lib/geoutils.ts
import { point, lineString } from '@turf/turf';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import lineSliceAlong from '@turf/line-slice-along';
import length from '@turf/length';
import type { Feature, Point, LineString } from 'geojson';

/** Utilidades GeoJSON */
export function makePointFromLngLat(lng: number, lat: number) {
  return point([lng, lat]);
}

export function makeLineString(coords: [number, number][]) {
  return lineString(coords);
}

/** Filtra puntos duplicados consecutivos */
function removeConsecutiveDuplicates(coords: [number, number][]) {
  const filtered: [number, number][] = [];
  for (let i = 0; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    if (!prev || prev[0] !== curr[0] || prev[1] !== curr[1]) {
      filtered.push(curr);
    }
  }
  return filtered;
}

/** nearestPointOnLine con logs y limpieza avanzada */
export function nearestInfoOnLine(ls: Feature<LineString>, p: Feature<Point>) {
  console.log("📏 [nearestInfoOnLine] Iniciando cálculo de punto más cercano...");

  try {
    console.log("🧩 [nearestInfoOnLine:input] LineString recibido:", JSON.stringify(ls.geometry, null, 2));
    console.log("🧩 [nearestInfoOnLine:input] Punto recibido:", JSON.stringify(p.geometry, null, 2));

    // Validaciones
    if (!ls?.geometry?.coordinates || ls.geometry.coordinates.length < 2) {
      throw new Error("LineString inválido o sin coordenadas suficientes");
    }

    const cleanedCoords = ls.geometry.coordinates.map((c) => {
      const lng = typeof c?.[0] === "number" ? c[0] : parseFloat(c?.[0]);
      const lat = typeof c?.[1] === "number" ? c[1] : parseFloat(c?.[1]);
      return [lng, lat] as [number, number];
    });

    const filteredCoords = removeConsecutiveDuplicates(cleanedCoords);

    if (filteredCoords.length < 2) {
      throw new Error("LineString quedó con menos de 2 puntos válidos tras limpiar duplicados");
    }

    console.log("🧼 [nearestInfoOnLine] filteredCoords (primeros 5):", filteredCoords.slice(0, 5));

    const [lng, lat] = p.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new Error("Punto con coordenadas no numéricas");
    }

    const cleanLine = lineString(filteredCoords);
    const cleanPoint = point([lng, lat]);

    console.log("✅ [nearestInfoOnLine] LineString limpio con", filteredCoords.length, "puntos.");
    console.log("✅ [nearestInfoOnLine] Punto limpio:", cleanPoint.geometry.coordinates);

    // 📍 Calcular punto más cercano
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res: any = nearestPointOnLine(cleanLine as any, cleanPoint as any, { units: 'kilometers' }) as any;
    const props = res.properties || {};

    const distKm =
      typeof props.dist === 'number'
        ? props.dist
        : typeof props.distance === 'number'
        ? props.distance
        : undefined;

    console.log("✅ [nearestInfoOnLine] Resultado final:", {
      distKm,
      index: props.index,
      location: props.location,
    });

    return {
      point: res,
      distanceKm: distKm,
      index: props.index,
      location: props.location,
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error("💥 [nearestInfoOnLine] Error crítico:", err.message);
    console.error("📊 [nearestInfoOnLine] Datos que causaron el error:", {
      lineCoords: ls?.geometry?.coordinates?.slice?.(0, 5),
      pointCoords: p?.geometry?.coordinates,
    });
    return null;
  }
}

export function sliceAlongByDistance(ls: Feature<LineString>, startKm: number, endKm: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lineSliceAlong(ls as any, startKm, endKm, { units: 'kilometers' }) as Feature<LineString>;
}

export function lengthKm(ls: Feature<LineString>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return length(ls as any, { units: 'kilometers' });
}
