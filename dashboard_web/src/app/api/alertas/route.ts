import { NextResponse } from 'next/server';
import { initFirestore } from '@/lib/firestoreClient';
import { getGenerativeModelWrapper } from '@/lib/geminiClient';
import { GeoPoint } from 'firebase-admin/firestore';

// Inicializamos Firestore y Gemini
const db = initFirestore();
const genAI = getGenerativeModelWrapper();

// 🔹 Configuración base
const MAX_DISTANCE_KM = 0.8;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ubicacion = body?.ubicacionUsuario;

    if (!ubicacion?.lat || !ubicacion?.lng) {
      return NextResponse.json({ error: "Faltan coordenadas" }, { status: 400 });
    }

    if (!db || !genAI) {
      return NextResponse.json({ error: "Servicios no inicializados" }, { status: 500 });
    }

    console.log("📍 Revisando alertas cercanas para:", ubicacion);

    // 🔹 Obtener todos los vehículos activos
    const vehiculosSnap = await db.collection('Vehiculos')
      .where('estado', 'in', ['en_ruta_ida', 'en_ruta_vuelta'])
      .get();

    const alertas: Array<{ mensaje: string }> = [];

    for (const doc of vehiculosSnap.docs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = doc.data() as any;
      const ubic = data.ubicacionActual as GeoPoint | undefined;
      const lineaId = data.lineaId as string | undefined;

      if (!ubic || !lineaId) continue;

      const distKm = haversineDistance(
        ubicacion.lat, ubicacion.lng,
        ubic.latitude, ubic.longitude
      );

      if (distKm <= MAX_DISTANCE_KM) {
        // Obtener nombre de línea
        const lineaSnap = await db.collection('Lineas').doc(lineaId).get();
        const lineaData = lineaSnap.exists ? lineaSnap.data() : null;
        const nombreLinea = lineaData?.nombre || "una línea desconocida";

        // 🧠 Generar mensaje con IA
        const prompt = `
Genera una alerta corta y natural (máximo 1 frase) informando al pasajero que un vehículo de la línea ${nombreLinea} está cerca (a ${(distKm * 1000).toFixed(0)} metros).
Ejemplo: "El bus de la línea 402 pasará cerca de ti en 5 minutos."
Responde solo con texto.
`;
        const texto = await genAI.generateText(prompt);
        alertas.push({ mensaje: texto });
      }
    }

    // Si no hay vehículos cerca, genera una alerta general con IA
    if (alertas.length === 0) {
      const fallbackPrompt = `
No se detectaron buses cercanos en la ubicación (${ubicacion.lat.toFixed(4)}, ${ubicacion.lng.toFixed(4)}).
Genera una alerta breve y amable tipo: "No hay buses cercanos por ahora, te avisaremos cuando uno se acerque."
`;
      const texto = await genAI.generateText(fallbackPrompt);
      alertas.push({ mensaje: texto });
    }

    return NextResponse.json({ alertas });

  } catch (error) {
    console.error("💥 Error en /api/alertas:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export const config = {
  runtime: 'nodejs',
};
