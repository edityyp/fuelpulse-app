import { plate, coupon } from '../shared/contracts';

type OcrWorker = { recognize: (canvas: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>; setParameters: (params: Record<string,string|number>) => Promise<void>; terminate: () => Promise<void> };
const letters=(s:string)=>s.replace(/[0158]/g,c=>({'0':'O','1':'I','5':'S','8':'B'}[c]!));
const digits=(s:string)=>s.replace(/[OQILZSB]/g,c=>({O:'0',Q:'0',I:'1',L:'1',Z:'2',S:'5',B:'8'}[c]!));
function variants(raw:string){const out:string[]=[];for(let d=1;d<=3;d++)for(let a=1;a<=3;a++)if(raw.length===2+d+a+4)out.push(letters(raw.slice(0,2))+digits(raw.slice(2,2+d))+letters(raw.slice(2+d,2+d+a))+digits(raw.slice(-4)));if(raw.length>=8&&raw.length<=10)out.push(digits(raw.slice(0,2))+'BH'+digits(raw.slice(4,8))+letters(raw.slice(8)));return out;}
// A read that matches a known plate layout (state code + digits + series + number,
// or the BH series) is trustworthy on its own. Anything else is "weak" - it passed
// the loose 4-15 char sanity check but isn't shaped like a real plate, so it needs
// corroboration (see STRONG_MIN_VOTES in ocr()/scanPlate()) before we act on it.
const STRONG_PLATE_RE=/^(?:[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{4}|[A-Z]{2}\d{2,3}[A-Z]{0,3}\d{1,4}|\d{2}BH\d{4}[A-Z]{1,2})$/;
// Real plates are essentially never under 6 characters once you strip
// separators; a 4-5 char token is almost always a partial/garbled OCR read
// (a torn edge, glare, a fragment of unrelated text) rather than a plate.
const MIN_CANDIDATE_LEN=6;
export function plateCandidates(text:string){
  const chunks=text.toUpperCase().split(/\r?\n/).flatMap(line=>{const clean=line.replace(/[^A-Z0-9]/g,'');return[clean,...line.split(/[^A-Z0-9]+/).filter(Boolean)];}).filter(v=>v.length>=MIN_CANDIDATE_LEN&&v.length<=15);
  const ranked=new Map<string,number>(),strong=new Set<string>();
  for(const raw of chunks)for(const candidate of [...variants(raw),raw]){
    const parsed=plate.safeParse(candidate);
    if(!parsed.success||!/[A-Z]/.test(parsed.data)||!/\d/.test(parsed.data))continue;
    const isStrong=STRONG_PLATE_RE.test(parsed.data);
    if(isStrong)strong.add(parsed.data);
    ranked.set(parsed.data,Math.max(ranked.get(parsed.data)??0,isStrong?100:20));
  }
  return[...ranked].sort((a,b)=>b[1]-a[1]).map(([value,quality])=>({value,quality,strong:strong.has(value)}));
}
export function plateFromOcrText(text:string){const c=plateCandidates(text)[0];if(c)return c.value;throw Error('Plate unclear. Move closer, avoid glare, or type it manually.');}
async function worker(){const{createWorker,PSM}=await import('tesseract.js');const w=await createWorker('eng',1);await w.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',preserve_interword_spaces:'0'});return w as unknown as OcrWorker;}
function enhance(canvas:HTMLCanvasElement,v:number){const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)return;const im=c.getImageData(0,0,canvas.width,canvas.height),d=im.data;for(let i=0;i<d.length;i+=4){const g=.299*d[i]+.587*d[i+1]+.114*d[i+2];let x=g;if(v===1)x=g>115?255:0;if(v===2)x=g>145?255:0;if(v===3)x=g>175?255:0;if(v===4)x=Math.max(0,Math.min(255,(g-128)*2.8+128));d[i]=d[i+1]=d[i+2]=x;}c.putImageData(im,0,0);}
async function fileCanvas(file:File){const b=await createImageBitmap(file),c=document.createElement('canvas'),s=Math.min(3,2200/b.width);c.width=Math.max(1,Math.round(b.width*s));c.height=Math.max(1,Math.round(b.height*s));c.getContext('2d')!.drawImage(b,0,0,c.width,c.height);b.close();return c;}
// A weak (unformatted) read only gets accepted if it showed up across at
// least this many of the enhancement passes below - a one-off short token is
// almost always noise, but the same token surviving several different
// thresholds/contrasts is a real signal.
const WEAK_MIN_SIGHTINGS=2;
export async function ocr(file:File){
  if(!file.type.startsWith('image/')||file.size>8*1024*1024)throw Error('Select an image under 8 MB');
  const w=await worker();
  try{
    const src=await fileCanvas(file),scores=new Map<string,number>(),sightings=new Map<string,number>(),strongValues=new Set<string>();
    for(let v=0;v<5;v++){
      const c=document.createElement('canvas');c.width=src.width;c.height=src.height;c.getContext('2d')!.drawImage(src,0,0);enhance(c,v);
      const r=await w.recognize(c);
      for(const p of plateCandidates(r.data.text)){
        scores.set(p.value,Math.max(scores.get(p.value)??0,p.quality+r.data.confidence));
        sightings.set(p.value,(sightings.get(p.value)??0)+1);
        if(p.strong)strongValues.add(p.value);
      }
    }
    const ranked=[...scores].sort((a,b)=>b[1]-a[1]||b[0].length-a[0].length);
    const best=ranked.find(([value])=>strongValues.has(value)||(sightings.get(value)??0)>=WEAK_MIN_SIGHTINGS);
    if(best)return best[0];
    throw Error('Plate unclear. Retake the photo closer, straighter, and without glare or reflections.');
  }finally{await w.terminate();}
}
export type PlateScanner={stop:()=>void};
export async function scanPlate(video:HTMLVideoElement,onPlate:(v:string)=>void,onError:(m:string)=>void,onProgress:(m:string)=>void):Promise<PlateScanner>{if(!navigator.mediaDevices?.getUserMedia)throw Error('Live scanning is unavailable. Use photo or manual entry.');const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:2560,min:1280},height:{ideal:1440,min:720}}});video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();const track=stream.getVideoTracks()[0];try{const caps=track.getCapabilities() as MediaTrackCapabilities&{focusMode?:string[];zoom?:{max?:number}};const advanced:MediaTrackConstraintSet[]=[];if(caps.focusMode?.includes('continuous'))advanced.push({focusMode:'continuous'});if((caps.zoom?.max??1)>1)advanced.push({zoom:Math.min(2,caps.zoom!.max!)});if(advanced.length)await track.applyConstraints({advanced});}catch{void 0;}let stopped=false,running=false,timer:number|undefined;const w=await worker();const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){await w.terminate();throw Error('Camera processing unavailable.');}const evidence=new Map<string,number>(),stop=()=>{if(stopped)return;stopped=true;if(timer!==undefined)clearTimeout(timer);stream.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null;void w.terminate();};const inspect=async()=>{if(stopped||running)return;if(video.readyState<2){timer=window.setTimeout(inspect,180);return;}running=true;try{const sw=video.videoWidth,sh=video.videoHeight,cw=Math.round(sw*.94),ch=Math.round(sh*.42),cx=Math.round((sw-cw)/2),cy=Math.max(0,Math.round((sh-ch)/2));const scale=Math.min(2.8,2300/cw);canvas.width=Math.max(1,Math.round(cw*scale));canvas.height=Math.max(1,Math.round(ch*scale));ctx.filter='grayscale(1) contrast(1.9)';ctx.drawImage(video,cx,cy,cw,ch,0,0,canvas.width,canvas.height);ctx.filter='none';enhance(canvas,Date.now()%5);const r=await w.recognize(canvas),found=plateCandidates(r.data.text);if(found.length){for(const p of found){const votes=(evidence.get(p.value)??0)+1;evidence.set(p.value,votes);onProgress(`Reading ${p.value} · ${votes} confirmations`);if((p.strong||votes>=3)&&p.value.length>=MIN_CANDIDATE_LEN){stop();onPlate(p.value);return;}}}else onProgress('No complete plate yet · centre the full plate');}catch(e){if(!stopped)onProgress(e instanceof Error?e.message:'Scanning…');}finally{running=false;}if(!stopped)timer=window.setTimeout(inspect,300);};timer=window.setTimeout(inspect,250);return{stop};}
export async function scan(video:HTMLVideoElement,onCode:(s:string)=>void){const{BrowserQRCodeReader}=await import('@zxing/browser');return new BrowserQRCodeReader().decodeFromVideoDevice(undefined,video,(result,_error,controls)=>{if(result){const value=coupon.safeParse(result.getText());if(value.success){controls.stop();onCode(value.data);void fillCouponPlate(value.data);}}});}
async function fillCouponPlate(code:string){try{const response=await fetch(`/api/coupons/lookup?code=${encodeURIComponent(code)}`,{credentials:'same-origin'});if(!response.ok)return;const data=await response.json() as {plate?:string};if(!data.plate)return;const input=document.querySelector<HTMLInputElement>('input[name="plate"]');if(!input)return;const value=data.plate.toUpperCase();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}catch{}}
interface Speech{lang:string;continuous:boolean;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:(()=>void)|null;start():void;stop():void}type SW=Window&{SpeechRecognition?:new()=>Speech;webkitSpeechRecognition?:new()=>Speech};export function speechSupported(){const w=window as SW;return!!(w.SpeechRecognition||w.webkitSpeechRecognition);}export function speak(onText:(s:string)=>void,onError:()=>void){const w=window as SW,R=w.SpeechRecognition??w.webkitSpeechRecognition;if(!R){onError();return;}try{const r=new R();r.lang='en-IN';r.continuous=false;r.onresult=e=>{const text=e.results[0]?.[0]?.transcript;if(text)onText(text);};r.onerror=onError;r.start();return()=>{try{r.stop();}catch{onError();}};}catch{onError();}}

