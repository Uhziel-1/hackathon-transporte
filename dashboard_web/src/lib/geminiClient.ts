// dashboard_web/src/lib/geminiClient.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

/**
 * Devuelve un objeto con helper functions:
 * - model.generateText(prompt, opts)
 * - model.generateJSON(prompt, opts) (intenta parsear JSON de la respuesta)
 *
 * Si no hay API key devuelve null.
 */
export function getGenerativeModelWrapper() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('[geminiClient] GEMINI_API_KEY not set');
    return null;
  }

  let client: GoogleGenerativeAI;
  try {
    client = new GoogleGenerativeAI(key);
  } catch (err) {
    console.error('[geminiClient] Error creating Gemini client', err);
    return null;
  }

  // Crea modelo con settings por defecto (ajusta modelo si lo deseas)
  function getModel() {
    return client.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      // Seguridad: NO forzar BLOCK_NONE. Usar thresholds por defecto o conservadores.
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }
      ]
    });
  }

  async function generateText(prompt: string) {
    try {
      const model = getModel();
      const res = await model.generateContent(prompt);
      return res.response.text().trim();
    } catch (err) {
      console.error('[geminiClient] generateText error', err);
      throw err;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function generateJSON<T = any>(prompt: string): Promise<T | null> {
    const raw = await generateText(prompt);
    // Try to extract JSON robustly
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/([\s\S]*\{[\s\S]*\})/);
    const jsonString = jsonMatch ? jsonMatch[1] : raw;
    try {
      return JSON.parse(jsonString);
    } catch (err) {
      console.warn('[geminiClient] Could not parse JSON from model response:', err);
      return null;
    }
  }

  return { generateText, generateJSON };
}
