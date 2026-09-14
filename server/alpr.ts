import type { FastifyInstance } from "fastify";

type RetiredRecognition={plate:string;confidence:number;ocr_confidence:number;detection_confidence:number};

/** Server-side FastALPR is retired. Browser scanning uses free Tesseract OCR on-device. */
export async function recognizeImage(_image:Buffer):Promise<RetiredRecognition>{
  throw Error("Server ALPR is retired; use the on-device plate scanner");
}

export function alprRoutes(app:FastifyInstance){
  app.post("/api/alpr",async()=>{throw Error("Server ALPR is retired; use the on-device plate scanner");});
}
