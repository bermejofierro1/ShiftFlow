import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

admin.initializeApp();

type ImportedTurn = { date: string; startTime: string };

export const importScheduleFromImage = onCall(
  { region: "us-central1" },
  async (request): Promise<{ turns: ImportedTurn[] }> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const imagePath = String(request.data?.imagePath ?? "");
    const aliases = Array.isArray(request.data?.aliases)
      ? request.data.aliases.map(String)
      : [];

    if (!imagePath) {
      throw new HttpsError("invalid-argument", "imagePath es obligatorio.");
    }
    if (!aliases.length) {
      throw new HttpsError("invalid-argument", "aliases es obligatorio.");
    }
    if (!imagePath.startsWith(`users/${uid}/`)) {
      throw new HttpsError("permission-denied", "Ruta no permitida.");
    }

    // 1) Descarga la imagen (buffer)
    const bucket = admin.storage().bucket();
    const file = bucket.file(imagePath);
    const [buffer] = await file.download();

    // 2) OCR (aquí meterás Vision)
    const text = ""; // TODO

    // 3) Parseo
    const turns = parseScheduleTextToTurns(text, aliases);

    return { turns };
  }
);

function parseScheduleTextToTurns(text: string, aliases: string[]): ImportedTurn[] {
  return [];
}
