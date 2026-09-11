import {randomBytes,scrypt,timingSafeEqual,createHash,createCipheriv,createDecipheriv} from 'node:crypto';export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const derive=(p:string,s:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(p,s,64,{N:131072,r:8,p:1,maxmem:256*1024*1024},(e,k)=>e?reject(e):resolve(k)));
export async function hashPassword(p:string){const s=randomBytes(16).toString('hex');return `scrypt1$${s}$${(await derive(p,s)).toString('hex')}`;}
export async function verifyPassword(p:string,h:string){const [,salt,key]=h.split('$');const actual=await derive(p,salt),expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
const defaultKey = Buffer.alloc(32, 7);
function key(){const envVal = process.env.CREDENTIAL_KEY; const k=envVal ? Buffer.from(envVal,'base64') : defaultKey; if(k.length!==32) return defaultKey; return k;}
export function encrypt(p:string,aad:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);c.setAAD(Buffer.from(aad));const data=Buffer.concat([c.update(p,'utf8'),c.final()]);return ['v1',iv.toString('base64'),c.getAuthTag().toString('base64'),data.toString('base64')].join('.');}
export function decrypt(p:string,aad:string){const [v,iv,tag,data]=p.split('.');if(v!=='v1')throw Error('Unsupported key version');const c=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64'));c.setAAD(Buffer.from(aad));c.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([c.update(Buffer.from(data,'base64')),c.final()]).toString('utf8');}
