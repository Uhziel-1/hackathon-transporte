// dashboard_web/src/lib/handlers/obtenerRuta.ts
import type { DBClient, GenAIClient } from '@/lib/types';
import { makePointFromLngLat, makeLineString, nearestInfoOnLine, sliceAlongByDistance, lengthKm } from '@/lib/geoutils';
import type { GeoPoint } from 'firebase-admin/firestore';

/**
 * Entrada:
 * - destino: nombre exacto (string) de POI en Firestore
 * - ubicacionUsuario: { lat, lng }
 *
 * Salida:
 * - { respuestaBot: string } (texto natural)
 *
 * Implementación: consulta POI, busca líneas que pasen cerca (<= 0.5 km),
 * para hasta 3 líneas toma vehículos activos y calcula ETA; luego formatea
 * respuesta usando genAI (sólo con datos de Firestore).
 */

const MAX_DISTANCE_KM = 0.5;
const VELOCIDAD_PROMEDIO_KMH = 15;

export async function handleBuscarRuta(params: {
  destino: string;
  ubicacionUsuario: { lat: number; lng: number };
  db: DBClient;
  genAI: GenAIClient;
}) {
  const { destino, ubicacionUsuario, db, genAI } = params;

  // 1) Obtener POI
  const poiSnap = await db.collection('Ubicaciones_POI').where('nombre', '==', destino).limit(1).get();
  if (poiSnap.empty) {
    return { respuestaBot: `No encontré "${destino}" en nuestra base de datos.` };
  }
  const poiDoc = poiSnap.docs[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poiData = poiDoc.data() as any;
  const coord = poiData.coordenada as GeoPoint | undefined;
  if (!coord || typeof coord.latitude !== 'number' || typeof coord.longitude !== 'number') {
    return { respuestaBot: `No hay coordenadas válidas para "${destino}" en la base de datos.` };
  }

  const destinationPoint = makePointFromLngLat(coord.longitude, coord.latitude);

  // 2) Leer todas las líneas (si tu dataset crece debes cambiar esto por consulta geoespacial)
  const linesSnap = await db.collection('Lineas').get();

  const rutasCercanas: Array<{
    id: string;
    nombre: string;
    distanciaADestinoM: number;
    rutaIda?: GeoPoint[];
    rutaVuelta?: GeoPoint[];
  }> = [];

  linesSnap.forEach(doc => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = doc.data() as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toCoords = (arr: any[] | undefined) => {
      if (!Array.isArray(arr) || arr.length < 2) return null;
      const out: [number, number][] = [];
      for (const p of arr) {
        if (p && typeof p.longitude === 'number' && typeof p.latitude === 'number') out.push([p.longitude, p.latitude]);
        else return null;
      }
      return out;
    };

    const ida = toCoords(data.rutaIda);
    const vuelta = toCoords(data.rutaVuelta);
    let distMin = Infinity;
    try {
      if (ida) {
        const ls = makeLineString(ida);
        const ni = nearestInfoOnLine(ls, destinationPoint);
        if (ni?.distanceKm != null) {
          distMin = Math.min(distMin, ni.distanceKm);
        }
      }

      if (vuelta) {
        const ls = makeLineString(vuelta);
        const ni = nearestInfoOnLine(ls, destinationPoint);
        if (ni?.distanceKm != null) {
          distMin = Math.min(distMin, ni.distanceKm);
        }
      }
    } catch (err) {
      console.warn('[obtenerRuta] Turf error for line', doc.id, err);
    }
    if (distMin <= MAX_DISTANCE_KM) {
      rutasCercanas.push({
        id: doc.id,
        nombre: data.nombre || 'Sin nombre',
        distanciaADestinoM: Math.round(distMin * 1000),
        rutaIda: data.rutaIda,
        rutaVuelta: data.rutaVuelta
      });
    }
  });

  if (rutasCercanas.length === 0) {
    return { respuestaBot: `No encontré líneas que pasen cerca de "${destino}".` };
  }

  rutasCercanas.sort((a, b) => a.distanciaADestinoM - b.distanciaADestinoM);

  // 3) Para hasta 3 rutas, buscar vehículos activos y calcular ETA
  const resultados: Array<{ nombreLinea: string; distanciaADestino: number; etaMinutos: number }> = [];

  const userPoint = makePointFromLngLat(ubicacionUsuario.lng, ubicacionUsuario.lat);

  const top = rutasCercanas.slice(0, 3);
  for (const ruta of top) {
    // Obtener vehículos activos para la línea
    const vehSnap = await db.collection('Vehiculos')
      .where('lineaId', '==', ruta.id)
      .where('estado', 'in', ['en_ruta_ida', 'en_ruta_vuelta'])
      .get();

    let mejorETA = Infinity;

    for (const vdoc of vehSnap.docs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vdata = vdoc.data() as any;
      const ubic = vdata.ubicacionActual as GeoPoint | undefined;
      const estado = vdata.estado as string | undefined;
      if (!ubic || typeof ubic.latitude !== 'number' || typeof ubic.longitude !== 'number' || !estado) continue;

      const busPoint = makePointFromLngLat(ubic.longitude, ubic.latitude);
      const polyGeo = (estado === 'en_ruta_ida') ? (ruta.rutaIda ?? []) : (ruta.rutaVuelta ?? []);
      if (!Array.isArray(polyGeo) || polyGeo.length < 2) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coords = polyGeo.map((p: any) => [p.longitude, p.latitude] as [number, number]);

      try {
        const ls = makeLineString(coords);
        const nearestBus = nearestInfoOnLine(ls, busPoint);
        const nearestUser = nearestInfoOnLine(ls, userPoint);

        // ✅ Verificación de null
        if (nearestBus && nearestUser &&
            nearestBus.index != null && nearestUser.index != null &&
            nearestBus.index <= nearestUser.index &&
            typeof nearestBus.location === 'number' &&
            typeof nearestUser.location === 'number') {
    
          const startKm = Math.min(nearestBus.location, nearestUser.location);
          const endKm = Math.max(nearestBus.location, nearestUser.location);
          const slice = sliceAlongByDistance(ls, startKm, endKm);
          const distKm = lengthKm(slice);
          const etaMin = Math.max(1, Math.round((distKm / VELOCIDAD_PROMEDIO_KMH) * 60));
    
          if (etaMin < mejorETA) mejorETA = etaMin;
        }
      } catch (err) {
        console.warn('[obtenerRuta] Error calculando ETA para vehiculo', vdoc.id, err);
      }
    }

    if (mejorETA !== Infinity) {
      resultados.push({ nombreLinea: ruta.nombre, distanciaADestino: ruta.distanciaADestinoM, etaMinutos: mejorETA });
    }
  }

  // 4) Si no hay resultados con ETA, responder indicando que no hay buses activos
  if (resultados.length === 0) {
    return { respuestaBot: `Encontré las siguientes líneas cerca de "${destino}", pero no hay buses activos en este momento en ruta hacia tu ubicación.` };
  }

  // 5) Ordenar por ETA y construir respuesta natural CON LA AYUDA de genAI
  resultados.sort((a, b) => a.etaMinutos - b.etaMinutos);

  // Prepara datos estrictos que se pasan al modelo: NUNCA enviar datos extra que no sean de Firestore
  const datosParaModel = {
    destino,
    ubicacionUsuario,
    resultados // lista de { nombreLinea, distanciaADestino (m), etaMinutos }
  };

  const prompt = `
Eres un asistente de transporte que SOLO debe usar la INFORMACIÓN proporcionada a continuación (datos provenientes de la base de datos).
No inventes nada. Responde en 1-2 frases, siendo claro y directo.

DATOS:
${JSON.stringify(datosParaModel, null, 2)}

Formatea la respuesta en lenguaje natural (español), concisa.
  `.trim();

  try {
    if (!genAI) throw new Error('Gemini client not initialized');
    const texto = await genAI.generateText(prompt);
    // Aseguramos que la respuesta sea limpia
    return { respuestaBot: texto };
  } catch (err) {
    console.warn('[obtenerRuta] Gemini fallo al formatear:', err);
    // Fallback manual (texto construido únicamente con datos de DB)
    let fallback = `Para ir a "${destino}":\n`;
    resultados.forEach(r => fallback += `- ${r.nombreLinea}: pasa a ${r.distanciaADestino}m del destino y llega en aprox. ${r.etaMinutos} min.\n`);
    return { respuestaBot: fallback.trim() };
  }
}
