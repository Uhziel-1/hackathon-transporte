// dashboard_web/src/lib/handlers/intentDetector.ts
import type { DBClient, GenAIClient } from '@/lib/types';

/**
 * detectIntent: Llama al modelo para extraer { intencion, destino, linea }
 * Importante: pasamos al prompt SOLO las listas de nombres recuperadas de Firestore
 * y la pregunta del usuario. El parser valida coincidencias exactas contra la lista.
 */
export async function detectIntent(params: { preguntaUsuario: string; db: DBClient; genAI: GenAIClient }) {
  const { preguntaUsuario, db, genAI } = params;

  // 1) obtener listas conocidas (cache simple en memoria podría implementarse)
  const [poisSnap, linesSnap] = await Promise.all([
    db.collection('Ubicaciones_POI').select('nombre').get(),
    db.collection('Lineas').select('nombre').get()
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const knownPoiNames = poisSnap.docs.map(d => (d.data() as any).nombre).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const knownLineNames = linesSnap.docs.map(d => (d.data() as any).nombre).filter(Boolean);

  // 2) Prompt estricto: devolver JSON EXACTO con intencion, destino, linea
  const prompt = `
Devuelve únicamente un JSON con las claves: "intencion", "destino", "linea".
- intencion: una de ["buscar_ruta","info_linea","info_lugar","info_paradero_cercano","saludo","desconocida"]
- destino: nombre EXACTO de la lista LUGARES o null
- linea: nombre EXACTO de la lista LINEAS o null

LUGARES: ${JSON.stringify(knownPoiNames)}
LINEAS: ${JSON.stringify(knownLineNames)}

PREGUNTA_USUARIO: "${preguntaUsuario.replace(/["\\]/g, '')}"

Responde SOLO con JSON.
`.trim();
  if (!genAI) throw new Error('Gemini client not initialized');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = await genAI.generateJSON<any>(prompt);
  if (!parsed) {
    return { intencion: 'desconocida', destino: null, linea: null };
  }

  // validate and canonicalize
  const validIntent = ['buscar_ruta','info_linea','info_lugar','info_paradero_cercano','saludo','desconocida'].includes(parsed.intencion)
    ? parsed.intencion
    : 'desconocida';

  const destino = typeof parsed.destino === 'string' && knownPoiNames.includes(parsed.destino) ? parsed.destino : null;
  const linea = typeof parsed.linea === 'string' && knownLineNames.includes(parsed.linea) ? parsed.linea : null;

  return { intencion: validIntent, destino, linea };
}
