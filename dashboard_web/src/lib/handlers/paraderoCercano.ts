import type { DBClient, GenAIClient } from '@/lib/types';
import { makePointFromLngLat, nearestInfoOnLine } from '@/lib/geoutils';
import * as turf from '@turf/turf';

type BestCandidate = {
  lineaId: string;
  lineaNombre: string;
  distKm: number;
  coord: { lat: number; lng: number };
};

export async function handleParaderoCercano(params: {
  ubicacionUsuario: { lat: number; lng: number };
  db: DBClient;
  genAI: GenAIClient;
}) {
  const { ubicacionUsuario, db, genAI } = params;

  console.log('\n==============================');
  console.log('🚀 [handleParaderoCercano] Iniciado');
  console.log('📍 Ubicación usuario:', ubicacionUsuario);
  console.log('==============================');

  let step = 0;

  try {
    step = 1;
    const linesSnap = await db.collection('Lineas').get();
    console.log(`[${step}] 🔍 Se encontraron ${linesSnap.size} líneas en Firestore.`);

    let best: BestCandidate | null = null;
    const userPoint = makePointFromLngLat(ubicacionUsuario.lng, ubicacionUsuario.lat);
    console.log(`[${++step}] 🗺️ Punto del usuario (GeoJSON):`, userPoint);

    linesSnap.forEach(doc => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = doc.data() as any;
        console.log(`\n[${++step}] 🚌 Analizando línea: ${data.nombre || '(sin nombre)'} (ID: ${doc.id})`);

        const pts = data.rutaIda || data.rutaVuelta;
        console.log(`[${step}] ▶ raw pts length:`, Array.isArray(pts) ? pts.length : 'no-array');

        if (!Array.isArray(pts) || pts.length === 0) {
          console.log(`[${step}] ⚠️ Línea sin puntos válidos, omitida.`);
          return;
        }

        const cleaned: Array<[number, number]> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let firstInvalid: any = null;

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const rawLat = p?.latitude ?? p?._latitude ?? p?.lat ?? p?.y ?? null;
          const rawLng = p?.longitude ?? p?._longitude ?? p?.lng ?? p?.x ?? null;

          if (i < 2) console.log(`[${step}]   • raw point[${i}] =`, p, ' -> lat/lng =', rawLat, rawLng);

          const latNum = rawLat !== null ? parseFloat(String(rawLat)) : NaN;
          const lngNum = rawLng !== null ? parseFloat(String(rawLng)) : NaN;

          if (!isFinite(latNum) || !isFinite(lngNum)) {
            if (!firstInvalid) firstInvalid = { index: i, raw: p };
            continue;
          }
          cleaned.push([lngNum, latNum]);
        }

        console.log(`[${step}] ▶ cleaned coords count:`, cleaned.length, 'firstInvalid:', firstInvalid);

        if (cleaned.length < 2) {
          console.log(`[${step}] ⚠️ No hay suficientes coordenadas válidas, se omite la línea.`);
          return;
        }

        // --- cálculo de distancia
        try {
          const cleanedCoords = cleaned
            .filter((c) => Array.isArray(c) && c.length === 2)
            .map(([lng, lat]) => [parseFloat(String(lng)), parseFloat(String(lat))])
            .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));

          console.log(`[${step}] 🧹 Coords limpias finales:`, cleanedCoords.length);

          const ls = turf.lineString(cleanedCoords);
          console.log(`[${step}] 🧱 LineString creado.`);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ni: any = nearestInfoOnLine(ls, userPoint);
          console.log(`[${step}] 🔍 nearestInfoOnLine result:`, ni);

          let distKm: number | null = null;
          let nearestCoords: [number, number] | null = null;

          if (ni) {
            // Compatibilidad con diferentes formatos
            distKm =
              typeof ni.distanceKm === 'number'
                ? ni.distanceKm
                : typeof ni.distKm === 'number'
                ? ni.distKm
                : typeof ni?.point?.properties?.dist === 'number'
                ? ni.point.properties.dist
                : typeof ni?.point?.properties?.distance === 'number'
                ? ni.point.properties.distance
                : null;

            // Extraer coordenadas del punto más cercano
            if (ni.point?.geometry?.coordinates?.length === 2) {
              nearestCoords = ni.point.geometry.coordinates;
            } else if (ni.nearestCoord) {
              nearestCoords = [ni.nearestCoord.lng, ni.nearestCoord.lat];
            }

            console.log(`[${step}] 📏 Distancia (km):`, distKm, 'Coords más cercanas:', nearestCoords);
          }

          if (distKm != null && isFinite(distKm) && distKm < (best?.distKm ?? Infinity)) {
            if (nearestCoords && nearestCoords.length === 2) {
              best = {
                lineaId: doc.id,
                lineaNombre: data.nombre || 'Sin nombre',
                distKm,
                coord: { lng: nearestCoords[0], lat: nearestCoords[1] },
              };
              console.log(`[${step}] ✅ Nueva mejor línea candidata:`, best);
            }
          }
        } catch (innerErr) {
          console.error(`[${step}] ❌ Error interno procesando línea:`, data.nombre, innerErr);
        }
      } catch (lineErr) {
        console.error(`[${step}] 🚨 Error inesperado en loop de líneas:`, lineErr);
      }
    });

    if (!best) {
      console.log(`[${++step}] 🚫 No se encontró un paradero cercano.`);
      return { respuestaBot: 'No encontré un paradero cercano en las rutas disponibles.' };
    }

    console.log(`\n[${++step}] 🏆 Mejor línea encontrada:`, best);
    const confirmedBest = best as BestCandidate;

    const prompt = `Devuelve 1-2 frases en español usando SOLO estos datos:
    Paradero estimado en la línea: ${confirmedBest.lineaNombre}
    Distancia aprox: ${(confirmedBest.distKm * 1000).toFixed(0)} m
    Coordenadas del punto: lat=${confirmedBest.coord.lat}, lng=${confirmedBest.coord.lng}`;

    console.log(`[${++step}] 🧠 Prompt para Gemini:`, prompt);

    try {
      if (!genAI) throw new Error('Gemini client not initialized');
      const texto = await genAI.generateText(prompt);
      console.log(`[${++step}] 🗣️ Respuesta generada por Gemini:`, texto);
      return { respuestaBot: texto };
    } catch (genErr) {
      console.warn(`[${step}] ⚠️ Gemini no disponible. Fallback local.`, genErr);
      return {
        respuestaBot: `Paradero cercano en ${confirmedBest.lineaNombre}, a ${(confirmedBest.distKm * 1000).toFixed(0)} m.`,
      };
    }

  } catch (err) {
    console.error(`💥 Error fatal en step ${step}:`, err);
    return { respuestaBot: `Error interno (step ${step})` };
  }
}
