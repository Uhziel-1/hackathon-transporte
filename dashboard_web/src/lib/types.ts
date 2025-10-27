// dashboard_web/src/lib/types.ts
import type { Firestore } from '@google-cloud/firestore';

export interface RequestBody {
  preguntaUsuario: string;
  ubicacionUsuario: { lat: number; lng: number };
}

export type DBClient = Firestore;
export type GenAIClient = ReturnType<typeof import('./geminiClient').getGenerativeModelWrapper>;
