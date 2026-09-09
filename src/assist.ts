import {plate,coupon} from '../shared/contracts';

const workerOptions={workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr'} as const;

export function plateFromOcrText(text:string){
  const candidates=text.toUpperCase().split(/\r?\n/).flatMap(line=>{
    const compact=line.replace(/[^A-Z0-9- ]/g,'').trim();
    const tokens=compact.split(/\s{2,}|[^A-Z0-9-]+/).filter(Boolean);
    return [compact,...tokens];
  });
  for(const candidate of candidates){
    const normalized=candidate.toUpperCase().replace(/[\s-]/g,'');
    if(!/[A-Z]/.test(normalized)||!/\d/.test(normalized))continue;
    const value=plate.safeParse(candidate);
    if(value.success)return value.data;
  }
  throw Error('Plate unclear. Hold it inside the guide in good light or type it manually.');
}

async function configuredWorker(){
  const {createWorker,PSM}=await import('tesseract.js');
  const worker=await createWorker('eng',1,workerOptions);
  await worker.setParameters({
    tessedit_pageseg_mode:PSM.SINGLE_LINE,
    tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -',
  });
  return worker;
}

export async function ocr(file:File){
  if(!file.type.startsWith('image/')||file.size>8*1024*1024)throw Error('Select an image under 8 MB');
  const worker=await configuredWorker();
  try{return plateFromOcrText((await worker.recognize(file)).data.text);}
  finally{await worker.terminate();}
}

export type PlateScanner={stop:()=>void};

export async function scanPlate(video:HTMLVideoElement,onPlate:(value:string)=>void,onError:(message:string)=>void):Promise<PlateScanner>{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Live camera scanning is unavailable in this browser. Use the photo option instead.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
  video.srcObject=stream;
  video.muted=true;
  video.playsInline=true;
  await video.play();
  let worker:Awaited<ReturnType<typeof configuredWorker>>|undefined;
  let stopped=false,running=false,timer:number|undefined,last='',matches=0;
  const stop=()=>{
    if(stopped)return;
    stopped=true;
    if(timer!==undefined)window.clearTimeout(timer);
    stream.getTracks().forEach(track=>track.stop());
    video.pause();
    video.srcObject=null;
    if(worker)void worker.terminate();
  };
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx){stop();throw Error('Camera processing is unavailable. Use the photo option instead.');}
  try{worker=await configuredWorker();}
  catch(error){stop();throw error;}
  const inspect=async()=>{
    if(stopped||running)return;
    if(video.readyState<2){timer=window.setTimeout(inspect,300);return;}
    running=true;
    try{
      const sourceWidth=video.videoWidth,sourceHeight=video.videoHeight;
      const cropWidth=Math.round(sourceWidth*.88),cropHeight=Math.round(sourceHeight*.34);
      const cropX=Math.round((sourceWidth-cropWidth)/2),cropY=Math.round((sourceHeight-cropHeight)/2);
      const scale=Math.min(2,1200/cropWidth);
      canvas.width=Math.max(1,Math.round(cropWidth*scale));
      canvas.height=Math.max(1,Math.round(cropHeight*scale));
      ctx.filter='grayscale(1) contrast(1.65)';
      ctx.drawImage(video,cropX,cropY,cropWidth,cropHeight,0,0,canvas.width,canvas.height);
      const detected=plateFromOcrText((await worker!.recognize(canvas)).data.text);
      if(detected===last)matches++;else{last=detected;matches=1;}
      if(matches>=2){stop();onPlate(detected);return;}
    }catch(error){
      if(stopped)return;
      const message=error instanceof Error?error.message:String(error);
      if(!message.startsWith('Plate unclear'))onError(message);
    }finally{running=false;}
    if(!stopped)timer=window.setTimeout(inspect,450);
  };
  timer=window.setTimeout(inspect,100);
  return {stop};
}

export async function scan(video:HTMLVideoElement,onCode:(s:string)=>void){
  const {BrowserQRCodeReader}=await import('@zxing/browser');
  return new BrowserQRCodeReader().decodeFromVideoDevice(undefined,video,(result,_error,controls)=>{
    if(result){const value=coupon.safeParse(result.getText());if(value.success){controls.stop();onCode(value.data);}}
  });
}

interface Speech{lang:string;continuous:boolean;onresult:((e:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;onerror:(()=>void)|null;start():void;stop():void}
type SpeechWindow=Window&{SpeechRecognition?:new()=>Speech;webkitSpeechRecognition?:new()=>Speech};
export function speechSupported(){const w=window as SpeechWindow;return !!(w.SpeechRecognition||w.webkitSpeechRecognition);}
export function speak(onText:(s:string)=>void,onError:()=>void){
  const w=window as SpeechWindow,Recognition=w.SpeechRecognition??w.webkitSpeechRecognition;
  if(!Recognition){onError();return;}
  try{const recognition=new Recognition();recognition.lang='en-IN';recognition.continuous=false;recognition.onresult=event=>{const text=event.results[0]?.[0]?.transcript;if(text)onText(text);};recognition.onerror=onError;recognition.start();return()=>{try{recognition.stop();}catch{onError();}};}
  catch{onError();}
}
