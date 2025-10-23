import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Nuestra primera función de prueba HTTP
export const holaMundo = onRequest((request, response) => {
  logger.info("¡Se ejecutó nuestra función holaMundo!");
  response.send("¡Hola desde la Nube (local)!");
});