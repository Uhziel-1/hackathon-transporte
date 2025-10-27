import { NextResponse } from 'next/server';
import { validateBody } from '@/lib/validation';
import { initFirestore } from '@/lib/firestoreClient';
import { getGenerativeModelWrapper } from '@/lib/geminiClient';
import { handleIntent } from '@/lib/handlers/router';
import type { RequestBody } from '@/lib/types';

// Initialize external clients (singletons)
const db = initFirestore();
const genAI = getGenerativeModelWrapper(); // may be null if no key

export async function POST(request: Request) {
  const time = new Date().toISOString();
  console.log(`\n🟢 [chatbot] Nueva solicitud recibida a las ${time}`);

  // --- Inicialización ---
  if (!db) {
    console.error('❌ [chatbot] Firestore no inicializado');
    return NextResponse.json({ error: 'Firebase not initialized' }, { status: 500 });
  }
  if (!genAI) {
    console.error('❌ [chatbot] Gemini no inicializado');
    return NextResponse.json({ error: 'Gemini not initialized' }, { status: 500 });
  }

  // --- Parseo del body ---
  let body: unknown;
  try {
    body = await request.json();
    console.log('📥 [chatbot] Body recibido:', body);
  } catch {
    console.error('❌ [chatbot] JSON inválido recibido');
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // --- Validación ---
  const parsed = validateBody(body);
  if (!parsed.ok) {
    console.warn('⚠️ [chatbot] Validación fallida:', parsed.error);
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const payload = parsed.value as RequestBody;
  console.log('✅ [chatbot] Payload validado correctamente:');
  console.log('   📌 Pregunta:', payload.preguntaUsuario);
  if (payload.ubicacionUsuario)
    console.log('   📍 Ubicación del usuario:', payload.ubicacionUsuario);
  else
    console.log('   ⚠️ No se recibió ubicación de usuario.');

  // --- Ejecución principal ---
  try {
    console.log('⚙️ [chatbot] Iniciando detección de intención y ejecución de handler...');
    const result = await handleIntent({
      preguntaUsuario: payload.preguntaUsuario,
      ubicacionUsuario: payload.ubicacionUsuario,
      db,
      genAI
    });

    console.log('📤 [chatbot] Resultado del handler:', result);

    // --- Validar salida ---
    if (!result || typeof result.respuestaBot !== 'string') {
      console.error('❌ [chatbot] Handler devolvió una respuesta inválida:', result);
      return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
    }

    console.log('✅ [chatbot] Respuesta final lista para enviar:', result.respuestaBot);
    return NextResponse.json({ respuestaBot: result.respuestaBot });

  } catch (error) {
    console.error('💥 [chatbot] Error no controlado:', error);
    return NextResponse.json({ error: 'Lo siento, ocurrió un error interno.' }, { status: 500 });
  }
}

// Puedes cambiar el runtime según tus necesidades.
// 'edge' es más rápido pero no soporta todas las APIs de Node.
export const config = {
  runtime: 'nodejs',
};
