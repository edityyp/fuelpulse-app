import { errorText } from "./api";
export async function fastAlprPhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 4 * 1024 * 1024)
    throw Error("Select a JPEG, PNG, or WebP image under 4 MB");
  const response = await fetch("/api/alpr", { method:"POST", credentials:"same-origin", headers:{"Content-Type":file.type}, body:file });
  const body=(await response.json().catch(()=>({error:"Plate recognition failed"}))) as {plate?:string;error?:string};
  if(!response.ok||!body.plate) throw Error(body.error??`FastALPR failed (${response.status})`);
  return body.plate;
}
export async function fastAlprWithFallback(file:File,fallback:(file:File)=>Promise<string>){
  try{return await fastAlprPhoto(file)}catch(primary){try{return await fallback(file)}catch{throw Error(`FastALPR: ${errorText(primary)}. Retake closer without glare, or type the plate manually.`)}}
}
