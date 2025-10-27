// dashboard_web/src/lib/handlers/infoLugar.ts

import type { DBClient, GenAIClient } from '@/lib/types';

export async function handleInfoLugar(params: { lugar: string; db: DBClient; genAI: GenAIClient }) {
  const { lugar, genAI } = params;

  // A futuro aquí se consultará Firestore (colección Lugares, etc.)
  // De momento devolvemos una respuesta controlada.
  const prompt = `El usuario preguntó por el lugar "${lugar}". 
  Si no hay datos en la base de datos, responde algo breve en español, 
  indicando que no hay información registrada de ese lugar.`;

  try {
    if (!genAI) throw new Error('Gemini client not initialized');
    const texto = await genAI.generateText(prompt);
    return { respuestaBot: texto };
  } catch {
    return { respuestaBot: `No encontré información registrada para "${lugar}".` };
  }
}
