// dashboard_web/src/lib/handlers/infoLinea.ts
import type { DBClient, GenAIClient } from '@/lib/types';

export async function handleInfoLinea(params: { linea: string; db: DBClient; genAI: GenAIClient }) {
  const { linea, db, genAI } = params;
  const snap = await db.collection('Lineas').where('nombre', '==', linea).limit(1).get();
  if (snap.empty) return { respuestaBot: `No encontré información para la línea "${linea}".` };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = snap.docs[0].data() as any;

  // Construye datos estrictos para el modelo (solo DB)
  const datos = {
    nombre: data.nombre,
    descripcion: data.descripcion || null,
    horarios: data.horarios || null,
    origen: data.origen || null,
    destino: data.destino || null
  };

  const prompt = `Usa SOLO estos datos (no inventes). Haz una respuesta corta en español describiendo la línea:\n${JSON.stringify(datos, null, 2)}`;
  try {
    if (!genAI) throw new Error('Gemini client not initialized');
    const texto = await genAI.generateText(prompt);
    return { respuestaBot: texto };
  } catch {
    // Fallback
    return { respuestaBot: `Línea ${datos.nombre}. ${datos.descripcion ? datos.descripcion : 'No hay descripción disponible.'}` };
  }
}
