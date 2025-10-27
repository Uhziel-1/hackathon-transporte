import type { DBClient, GenAIClient } from '@/lib/types';
import { detectIntent } from './intentDetector';
import { handleBuscarRuta } from './obtenerRuta';
import { handleInfoLinea } from './infoLinea';
import { handleInfoLugar } from './infoLugar';
import { handleParaderoCercano } from './paraderoCercano';

export async function handleIntent(params: {
  preguntaUsuario: string;
  ubicacionUsuario: { lat: number; lng: number };
  db: DBClient;
  genAI: GenAIClient;
}) {
  const { preguntaUsuario, ubicacionUsuario, db, genAI } = params;

  console.log('\n🤖 [router] Nueva solicitud de intención');
  console.log('🗣️ Pregunta del usuario:', preguntaUsuario);
  console.log('📍 Ubicación del usuario:', ubicacionUsuario);

  // Detecta intención y entidades (POI/Line name) usando Gemini, pero con lista conocida de DB
  const detection = await detectIntent({ preguntaUsuario, db, genAI });
  console.log('🔍 [router] Resultado de detectIntent:', detection);

  const intent = detection.intencion || 'desconocida';
  const destino = detection.destino || null;
  const linea = detection.linea || null;

  console.log(`🎯 [router] Intención detectada: ${intent}`);
  console.log(`🏁 [router] Destino detectado: ${destino}`);
  console.log(`🚌 [router] Línea detectada: ${linea}`);

  if (intent === 'buscar_ruta' && destino) {
    console.log('➡️ [router] Redirigiendo a handler: handleBuscarRuta');
    const result = await handleBuscarRuta({ destino, ubicacionUsuario, db, genAI });
    console.log('✅ [router] Resultado de handleBuscarRuta:', result);
    return result;
  }

  if (intent === 'info_linea' && linea) {
    console.log('➡️ [router] Redirigiendo a handler: handleInfoLinea');
    const result = await handleInfoLinea({ linea, db, genAI });
    console.log('✅ [router] Resultado de handleInfoLinea:', result);
    return result;
  }

  if (intent === 'info_lugar' && destino) {
    console.log('➡️ [router] Redirigiendo a handler: handleInfoLugar');
    const result = await handleInfoLugar({ lugar: destino, db, genAI });
    console.log('✅ [router] Resultado de handleInfoLugar:', result);
    return result;
  }

  if (intent === 'info_paradero_cercano') {
    console.log('➡️ [router] Redirigiendo a handler: handleParaderoCercano');
    const result = await handleParaderoCercano({ ubicacionUsuario, db, genAI });
    console.log('✅ [router] Resultado de handleParaderoCercano:', result);
    return result;
  }

  if (intent === 'saludo') {
    console.log('👋 [router] Intención: saludo');
    return { respuestaBot: '¡Hola! ¿En qué puedo ayudarte hoy?' };
  }

  console.warn('⚠️ [router] Intención desconocida o sin entidad suficiente.');
  // Fallback: si falta entidad pero intención sugería que debería haberla, respondemos indicando no hay info
  return {
    respuestaBot:
      'Lo siento, no pude identificar un lugar o línea específico con la información que diste. ¿Puedes decir el nombre exacto del lugar o la línea?',
  };
}
