import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { GeoPoint } from 'firebase-admin/firestore';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'; // Importar safety settings
// Turf imports (correctos)
import { point } from '@turf/helpers';
import { lineString } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import lineSliceAlong from '@turf/line-slice-along';
import length from '@turf/length';
import type { Feature as GeoJsonFeature, Point as GeoJsonPoint, Position as GeoJsonPosition } from 'geojson';

// --- Interfaces (sin cambios) ---
interface LineaDataAPI { /* ... */
    id: string; nombre: string; distanciaADestino: number;
    rutaIdaGeoPoints: GeoPoint[]; rutaVueltaGeoPoints: GeoPoint[];
}
interface ResultadoETA { /* ... */
    nombreLinea: string; distanciaADestino: number; etaMinutos: number;
}

// --- Inicialización Firebase Admin SDK (sin cambios) ---
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
let db: admin.firestore.Firestore;
// ... (mismo código de inicialización que antes) ...
if (serviceAccountKey) { try { const serviceAccount = JSON.parse(serviceAccountKey); if (!admin.apps.length) { admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }); console.log("Firebase Admin SDK initialized."); } else { console.log("Firebase Admin SDK already initialized."); } db = admin.firestore(); } catch (error) { console.error("Error initializing Firebase Admin SDK:", error); }
} else { console.error("FIREBASE_SERVICE_ACCOUNT_KEY env var not set!"); }

// --- Inicialización Gemini AI (sin cambios) ---
const geminiApiKey = process.env.GEMINI_API_KEY;
let genAI: GoogleGenerativeAI | null = null;
// ... (mismo código de inicialización que antes) ...
if (geminiApiKey) { try { genAI = new GoogleGenerativeAI(geminiApiKey); console.log("Gemini AI initialized."); } catch(error) { console.error("Error initializing Gemini AI:", error); }
} else { console.error("GEMINI_API_KEY env var not set!"); }

// --- Cache simple para nombres de POIs/Líneas (sin cambios) ---
let knownPoiNames: string[] = [];
let knownLineNames: string[] = [];
let lastCacheUpdate = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000;
async function updateKnownNamesCache() { /* ... (mismo código que antes) ... */
    const now = Date.now(); if (now - lastCacheUpdate < CACHE_DURATION_MS && knownPoiNames.length > 0) { console.log("Using cached POI/Line names."); return; } console.log("Updating POI/Line names cache..."); try { const [poiSnapshot, lineSnapshot] = await Promise.all([ db.collection('Ubicaciones_POI').select('nombre').get(), db.collection('Lineas').select('nombre').get() ]); knownPoiNames = poiSnapshot.docs.map(doc => doc.data().nombre).filter(Boolean); knownLineNames = lineSnapshot.docs.map(doc => doc.data().nombre).filter(Boolean); lastCacheUpdate = now; console.log(`Cache updated: ${knownPoiNames.length} POIs, ${knownLineNames.length} Lines`); } catch (error) { console.error("Error updating known names cache:", error); }
}

// --- Handler POST de la API Route ---
export async function POST(request: Request) {
    // --- LOG: Inicio ---
    console.log("-----------------------------------------");
    console.log(`[${new Date().toISOString()}] API Route /api/chatbot invoked.`);
    // --- FIN LOG ---
    if (!db) { console.error("Firebase not initialized!"); return NextResponse.json({ error: "Firebase not initialized" }, { status: 500 }); }
    if (!genAI) { console.error("Gemini not initialized!"); return NextResponse.json({ error: "Gemini not initialized" }, { status: 500 }); }

    let requestBody;
    try { requestBody = await request.json(); console.log("[Step 1] Request Body Parsed:", requestBody); }
    catch (error) { console.error("Error parsing request body:", error); return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }

    // 1. Validar Input
    const { preguntaUsuario, ubicacionUsuario } = requestBody;
    if (!preguntaUsuario || !ubicacionUsuario || typeof ubicacionUsuario.lat !== 'number' || typeof ubicacionUsuario.lng !== 'number') {
      console.error("Validation Error: Missing or invalid input.");
      return NextResponse.json({ error: "Missing 'preguntaUsuario' or valid 'ubicacionUsuario' (with lat/lng numbers)" }, { status: 400 });
    }
    const userLocation: GeoJsonFeature<GeoJsonPoint> = point([ubicacionUsuario.lng, ubicacionUsuario.lat]);
    console.log("[Step 2] Input Validated. User Location:", userLocation.geometry.coordinates);

    // Función auxiliar para validar y convertir GeoPoints
    const getValidCoords = (geoPoints: GeoPoint[] | undefined, lineaIdForLog: string): GeoJsonPosition[] | null => { /* ... (sin cambios) ... */
        if (!geoPoints || geoPoints.length < 2) return null; const coords: GeoJsonPosition[] = [];
        for (const gp of geoPoints) { if (gp instanceof GeoPoint && typeof gp.longitude === 'number' && typeof gp.latitude === 'number') { coords.push([gp.longitude, gp.latitude]); } else { console.warn(`Invalid GeoPoint found in Linea ${lineaIdForLog}:`, gp); return null; } } return coords;
    };


    try {
        await updateKnownNamesCache(); // Actualizar caché de nombres
        console.log("[Step 3] Known names cache updated/checked.");

        // --- Paso A: Entender Intención/Destino (Gemini con Lista de Nombres y Prompt Estricto) ---
        let destinoExacto: string | null = null;
        let lineaExacta: string | null = null;
        let intencion = 'desconocida';
        const model = genAI.getGenerativeModel({
             model: "gemini-2.5-flash-preview-09-2025",
             // --- NUEVO: Safety Settings para reducir bloqueo ---
             safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
             ]
        });
        const knownPlacesString = knownPoiNames.join('", "'); // Formato para lista en prompt
        const knownLinesString = knownLineNames.join('", "');

        // --- PROMPT MUY ESTRICTO ---
        const promptIntencion = `Tu única tarea es analizar la PREGUNTA y devolver un objeto JSON válido con las claves "intencion" y "destino" y "linea". No añadas explicaciones, markdown ni ningún otro texto fuera del JSON.
        Intención: Identifica la intención principal entre "obtener_ruta", "info_linea", "saludo", "desconocida".
        Destino: Si la intención es "obtener_ruta" o similar, identifica el lugar mencionado. Compara el lugar mencionado con la lista de LUGARES CONOCIDOS y devuelve el nombre EXACTO de la lista que mejor coincida. Si no hay coincidencia clara o no se menciona destino, devuelve null.
        Linea: Si la pregunta menciona una línea, compara con la lista de LINEAS CONOCIDAS y devuelve el nombre EXACTO de la lista. Si no, devuelve null.

        LUGARES CONOCIDOS: ["${knownPlacesString}"]
        LINEAS CONOCIDAS: ["${knownLinesString}"]

        PREGUNTA: "${preguntaUsuario}"
        JSON:`;
        // --- FIN PROMPT ESTRICTO ---

        console.log("[Step 4] Calling Gemini for intention/entity extraction with strict prompt...");
        console.log("Prompt:", promptIntencion); // Loguear el prompt ayuda a depurar
        try {
             const result = await model.generateContent(promptIntencion);
             const rawJsonResponse = result.response.text().trim();
             console.log("[Step 4a] Raw Gemini Response:", rawJsonResponse);

             // --- PARSEO MÁS ROBUSTO ---
             // Intentar encontrar el JSON, incluso si tiene ```json alrededor
             const jsonMatch = rawJsonResponse.match(/```json\s*(\{.*\})\s*```/s) || rawJsonResponse.match(/(\{.*\})/s);
             if (jsonMatch && jsonMatch[1]) {
                 const jsonString = jsonMatch[1];
                 try {
                     const parsedResponse = JSON.parse(jsonString);
                     intencion = parsedResponse.intencion && ["obtener_ruta", "info_linea", "saludo", "desconocida"].includes(parsedResponse.intencion) ? parsedResponse.intencion : 'desconocida';
                     // Validar contra listas conocidas
                     destinoExacto = (typeof parsedResponse.destino === 'string' && knownPoiNames.includes(parsedResponse.destino)) ? parsedResponse.destino : null;
                     lineaExacta = (typeof parsedResponse.linea === 'string' && knownLineNames.includes(parsedResponse.linea)) ? parsedResponse.linea : null;
                     console.log(`[Step 4b] Gemini interpreted & validated: Intencion=${intencion}, Destino=${destinoExacto}, Linea=${lineaExacta}`);
                     // Advertencias si no se validó pero la intención sugería que debía haber algo
                     if (intencion === 'obtener_ruta' && !destinoExacto && parsedResponse.destino) { console.warn("Gemini returned POI not in known list:", parsedResponse.destino); }
                     if ((intencion === 'preguntar_eta_linea' || intencion === 'info_linea') && !lineaExacta && parsedResponse.linea) { console.warn("Gemini returned Line not in known list:", parsedResponse.linea); }
                 } catch (parseError) {
                      console.error("Error parsing JSON from Gemini response:", parseError, "--- JSON String was:", jsonString);
                      intencion = 'desconocida'; // Marcar como desconocida si el JSON está mal formado
                 }
             } else {
                 console.warn("Could not extract JSON block from Gemini response:", rawJsonResponse);
                 intencion = 'desconocida';
             }
             // --- FIN PARSEO ROBUSTO ---

        } catch (geminiError) {
            console.error("Error calling Gemini API for intention:", geminiError);
            intencion = 'desconocida'; // Marcar como desconocida si falla la llamada
        }
        // --- Fin Paso A ---


        // --- Procesar según Intención (Lógica sin cambios, pero ahora depende de la extracción correcta) ---
        console.log(`[Step 5] Processing intention: ${intencion}`);
        if (intencion === 'buscar_ruta' && destinoExacto) {
            console.log(`[Step 5.1] Intention: buscar_ruta for "${destinoExacto}"`);
            // Pasos B, C, D (Firestore, Turf)
            console.log("[Step 5.1a] Searching for POI in Firestore...");
            // La búsqueda sigue siendo exacta, pero ahora `destinoExacto` debería ser el nombre correcto
            const poiQuery = await db.collection('Ubicaciones_POI').where('nombre', '==', destinoExacto).limit(1).get();
            if (poiQuery.empty) { console.error(`POI "${destinoExacto}" not found despite validation.`); return NextResponse.json({ respuestaBot: `No encontré detalles para "${destinoExacto}".` }); }
            const poiDoc = poiQuery.docs[0]; const coordenadaDestino = poiDoc.data().coordenada as GeoPoint;
            const destinationPoint = point([coordenadaDestino.longitude, coordenadaDestino.latitude]);
            console.log(`[Step 5.1b] POI Found: ${poiDoc.id}`);

            console.log("[Step 5.1c] Searching for nearby lines...");
            const lineasSnapshot = await db.collection('Lineas').get();
            const rutasCercanas: LineaDataAPI[] = []; const DISTANCIA_MAX_RUTA_A_DESTINO_KM = 0.5;
            lineasSnapshot.forEach(lineaDoc => { /* ... (buscar rutas cercanas, misma lógica que antes) ... */
                 const lineaData = lineaDoc.data(); const rutaIdaCoords = getValidCoords(lineaData.rutaIda as GeoPoint[] | undefined, lineaDoc.id); const rutaVueltaCoords = getValidCoords(lineaData.rutaVuelta as GeoPoint[] | undefined, lineaDoc.id); let distanciaMinima = Infinity; try { if (rutaIdaCoords) { const lsIda = lineString(rutaIdaCoords); const ptInfoIda = nearestPointOnLine(lsIda, destinationPoint, { units: 'kilometers' }); distanciaMinima = Math.min(distanciaMinima, ptInfoIda.properties.dist ?? Infinity); } if (rutaVueltaCoords) { const lsVuelta = lineString(rutaVueltaCoords); const ptInfoVuelta = nearestPointOnLine(lsVuelta, destinationPoint, { units: 'kilometers' }); distanciaMinima = Math.min(distanciaMinima, ptInfoVuelta.properties.dist ?? Infinity); } } catch (turfError) { console.error(`Turf distance error Linea ${lineaDoc.id}:`, turfError); return; } if (distanciaMinima <= DISTANCIA_MAX_RUTA_A_DESTINO_KM) { rutasCercanas.push({ id: lineaDoc.id, nombre: lineaData.nombre ?? 'Sin Nombre', distanciaADestino: Math.round(distanciaMinima * 1000), rutaIdaGeoPoints: (lineaData.rutaIda as GeoPoint[] | undefined) ?? [], rutaVueltaGeoPoints: (lineaData.rutaVuelta as GeoPoint[] | undefined) ?? [], }); }
            });
            rutasCercanas.sort((a, b) => a.distanciaADestino - b.distanciaADestino);
            console.log(`[Step 5.1d] Found ${rutasCercanas.length} nearby lines:`, rutasCercanas.map(r => r.nombre));
            if (rutasCercanas.length === 0) { return NextResponse.json({ respuestaBot: `No encontré líneas que pasen cerca de "${destinoExacto}".` }); }

            // D: Buscar Buses y Calcular ETA
            console.log("[Step 5.1e] Searching for active buses and calculating ETAs...");
            const VELOCIDAD_PROMEDIO_KMH = 15; const resultados: ResultadoETA[] = [];
            await Promise.all(rutasCercanas.slice(0, 3).map(async (ruta) => { /* ... (calcular ETA, misma lógica que antes) ... */
                const vehiculosQuery = await db.collection('Vehiculos').where('lineaId', '==', ruta.id).where('estado', 'in', ['en_ruta_ida', 'en_ruta_vuelta']).get(); let mejorETA = Infinity; console.log(` -> Found ${vehiculosQuery.docs.length} active buses for ${ruta.nombre}`);
                for (const vehiculoDoc of vehiculosQuery.docs) {
                    const vehiculoData = vehiculoDoc.data(); const ubicacionActual = vehiculoData.ubicacionActual as GeoPoint | undefined; const estadoVehiculo = vehiculoData.estado as string | undefined; if (!ubicacionActual || !estadoVehiculo) continue; const busPoint = point([ubicacionActual.longitude, ubicacionActual.latitude]); const polylineGeoPoints = (estadoVehiculo === 'en_ruta_ida') ? ruta.rutaIdaGeoPoints : ruta.rutaVueltaGeoPoints; const polylineCoords = getValidCoords(polylineGeoPoints, ruta.id); if (!polylineCoords) { console.warn(`Invalid route for ETA: Linea ${ruta.id}, Direccion: ${estadoVehiculo}`); continue; }
                    try { const ls = lineString(polylineCoords); const nearestBusPointInfo = nearestPointOnLine(ls, busPoint, { units: 'kilometers' }); const nearestUserPointInfo = nearestPointOnLine(ls, userLocation, { units: 'kilometers' });
                        if (nearestBusPointInfo.properties.location != null && nearestUserPointInfo.properties.location != null && nearestBusPointInfo.properties.index != null && nearestUserPointInfo.properties.index != null && nearestBusPointInfo.properties.index <= nearestUserPointInfo.properties.index) {
                            const startDist = nearestBusPointInfo.properties.location; const endDist = nearestUserPointInfo.properties.location; if (startDist !== undefined && endDist !== undefined) { const slice = lineSliceAlong(ls, Math.min(startDist, endDist), Math.max(startDist, endDist), { units: 'kilometers' }); const distanciaPolylineKm = length(slice, { units: 'kilometers' }); const etaMinutos = Math.max(1, Math.round((distanciaPolylineKm / VELOCIDAD_PROMEDIO_KMH) * 60)); console.log(`  --> Bus ${vehiculoDoc.id} (${ruta.nombre}): Dist=${distanciaPolylineKm.toFixed(2)}km, ETA=${etaMinutos}min`); mejorETA = Math.min(mejorETA, etaMinutos); } else { console.log(`  --> Bus ${vehiculoDoc.id} (${ruta.nombre}): Could not get start/end dist`); }
                        } else { console.log(`  --> Bus ${vehiculoDoc.id} (${ruta.nombre}): Bus is past user (Index ${nearestBusPointInfo.properties.index} vs ${nearestUserPointInfo.properties.index})`); }
                    } catch (turfError) { console.error(`ETA Turf Error Vehiculo ${vehiculoDoc.id}:`, turfError); continue; }
                } if (mejorETA !== Infinity) { resultados.push({ nombreLinea: ruta.nombre, distanciaADestino: ruta.distanciaADestino, etaMinutos: mejorETA, }); }
            }));
            console.log("[Step 5.1f] ETA Calculation Results:", resultados);

            // E: Formatear Respuesta (Usando Gemini - PROMPT MÁS ESTRICTO)
            console.log("[Step 5.1g] Calling Gemini to format final response...");
            // --- PROMPT RESPUESTA ESTRICTO ---
            let promptRespuesta = `Eres un asistente de transporte en Juliaca. Formula una respuesta CORTA y AMIGABLE (1-3 frases) para el usuario que quiere ir a "${destinoExacto}", basándote EXCLUSIVAMENTE en estos resultados de ETA calculados (ordenados por más rápido):`;
            if (resultados.length > 0) {
                 resultados.forEach(res => {
                    promptRespuesta += `\n- ${res.nombreLinea}: llega en ${res.etaMinutos} min (pasa a ${res.distanciaADestino}m del destino).`;
                 });
            } else {
                 promptRespuesta += `\n- No se encontraron buses cercanos en ruta hacia el usuario.`;
            }
            promptRespuesta += "\nNO añadas información extra. Sé directo y útil.";
            // --- FIN PROMPT RESPUESTA ---

            try { const resultRespuesta = await model.generateContent(promptRespuesta); const respuestaFinal = resultRespuesta.response.text().trim();
                  console.log("[Step 5.1h] Final Bot Response (from Gemini):", respuestaFinal);
                  return NextResponse.json({ respuestaBot: respuestaFinal });
            } catch { /* ... (Fallback manual sin cambios) ... */ }

        // ... (resto de manejo de intenciones - añadir logs) ...
        } else if (intencion === 'info_linea' && lineaExacta) {
             console.log(`[Step 5.2] Intention: info_linea for "${lineaExacta}"`);
             // ...
             return NextResponse.json({ respuestaBot: `Información sobre ${lineaExacta}... (No implementado)` });
        } else if (intencion === 'info_lugar' && destinoExacto) {
            console.log(`[Step 5.3] Intention: info_lugar for "${destinoExacto}"`);
            // ...
             return NextResponse.json({ respuestaBot: `Líneas cerca de ${destinoExacto}... (No implementado)` });
        } else if (intencion === 'info_paradero_cercano') {
            console.log(`[Step 5.4] Intention: info_paradero_cercano`);
             // ...
             return NextResponse.json({ respuestaBot: `Buscando paradas cercanas... (No implementado)` });
        } else if (intencion === 'saludo') {
             console.log(`[Step 5.5] Intention: saludo`);
             return NextResponse.json({ respuestaBot: `¡Hola! ¿En qué puedo ayudarte?` });
        } else { // Intención desconocida
            console.log(`[Step 5.6] Intention: desconocida`);
              // Intentar respuesta genérica (Prompt más simple)
              try {
                  const promptGeneral = `Eres un asistente de transporte en Juliaca. Responde de forma breve y amigable a: "${preguntaUsuario}"`;
                  const resultGeneral = await model.generateContent(promptGeneral);
                  const respuestaGeneral = resultGeneral.response.text().trim();
                  console.log("[Step 5.6a] General Fallback Response:", respuestaGeneral);
                  return NextResponse.json({ respuestaBot: respuestaGeneral });
              } catch (geminiError) { console.error("Error Gemini general query:", geminiError); return NextResponse.json({ respuestaBot: "No entendí. Pregúntame cómo llegar a un lugar." }); }
        }

    } catch (error) {
        console.error("Unhandled error in /api/chatbot:", error);
        return NextResponse.json({ error: "Lo siento, ocurrió un error interno grave." }, { status: 500 });
    } finally {
        console.log("-----------------------------------------"); // Separador
    }
}

// Configuración Vercel (sin cambios)
export const maxDuration = 30;

