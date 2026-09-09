import {useEffect,useRef,useState} from 'react';
import {transaction,type Catalog,type Input} from '../shared/contracts';
import {money,errorText} from './api';
import {ocr,scanPlate,speak,speechSupported,type PlateScanner} from './assist';
import './scanner.css';

export function TransactionForm({catalog,save,notify}:{catalog:Catalog;save:(value:Input)=>Promise<void>;notify:(message:string)=>void}){
  const[pump,setPump]=useState(''),[fuel,setFuel]=useState(''),[plate,setPlate]=useState(''),[litres,setLitres]=useState('');
  const[review,setReview]=useState(false),[busy,setBusy]=useState(false),[scanning,setScanning]=useState(false),[scanMessage,setScanMessage]=useState('Opening camera…');
  const[key,setKey]=useState(crypto.randomUUID()),[voiceField,setVoiceField]=useState('plate');
  const voiceStop=useRef<(()=>void)|undefined>(undefined),camera=useRef<PlateScanner|undefined>(undefined),video=useRef<HTMLVideoElement>(null);
  const stopCamera=()=>{camera.current?.stop();camera.current=undefined;setScanning(false);};
  useEffect(()=>()=>{voiceStop.current?.();camera.current?.stop();},[]);
  const price=catalog.fuels.find(item=>item.id===fuel)?.price_paise;
  const startScanner=async()=>{
    stopCamera();setScanMessage('Opening camera…');setScanning(true);setBusy(true);setReview(false);
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    try{
      if(!video.current)throw Error('Camera preview is unavailable. Use the photo option instead.');
      camera.current=await scanPlate(video.current,value=>{
        setPlate(value);setReview(false);setScanning(false);camera.current=undefined;
        notify(`Plate ${value} detected. Check it before confirming.`);
      },message=>notify(`Camera scanner: ${message}`),message=>setScanMessage(message));
      setScanMessage('Scanner ready. Hold the plate inside the green guide.');
    }catch(error){stopCamera();notify(errorText(error));}
    finally{setBusy(false);}
  };
  return <div className="grid"><section className="panel"><p className="eyebrow">01 / FILL DETAILS</p><h2>Record a fuel transaction</h2>
    <form onSubmit={async event=>{event.preventDefault();try{const input=transaction.parse({idempotency_key:key,pump_id:pump,fuel_id:fuel,plate,quantity_ml:Math.round(Number(litres)*1000)});if(!review){setReview(true);return;}setBusy(true);await save(input);setPlate('');setLitres('');setReview(false);setKey(crypto.randomUUID());}catch(error){notify(errorText(error));}finally{setBusy(false);}}}>
      <label>Pump<select aria-label="Pump" required value={pump} onChange={event=>{setPump(event.target.value);setFuel('');setReview(false);}}><option value="">Choose pump</option>{catalog.pumps.filter(item=>item.active).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Vehicle number<input required maxLength={20} value={plate} placeholder="MH12AB1234" onChange={event=>{setPlate(event.target.value.toUpperCase());setReview(false);}}/></label>
      <div className="camera-actions"><button type="button" onClick={scanning?stopCamera:startScanner} disabled={busy}>{busy?'Starting camera…':scanning?'Stop live scanner':'Scan number plate live'}</button><span className="muted">Use the rear camera and hold the plate inside the guide.</span></div>
      <div className={`plate-camera ${scanning?'active':''}`} aria-hidden={!scanning}>
        <video ref={video} muted playsInline/>
        <div className="plate-guide"><span>ALIGN NUMBER PLATE HERE</span></div>
        {scanning&&<div className="scan-status" role="status"><i/>{scanMessage}</div>}
      </div>
      <label className="upload">Photo fallback<input type="file" accept="image/*" capture="environment" disabled={busy||scanning} onChange={async event=>{const file=event.target.files?.[0];if(!file)return;setBusy(true);try{setPlate(await ocr(file));setReview(false);notify('Plate detected from photo. Check and correct it before confirming.');}catch(error){notify(errorText(error));}finally{setBusy(false);event.target.value='';}}}/><span className="muted">Use this if live scanning is unavailable.</span></label>
      <div className="two"><label>Fuel<select aria-label="Fuel" required value={fuel} onChange={event=>{setFuel(event.target.value);setReview(false);}}><option value="">Choose fuel</option>{catalog.fuels.filter(item=>catalog.links.some(link=>link.pump_id===pump&&link.fuel_id===item.id)).map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Quantity (litres)<input type="number" min="0.1" max="2000" step="0.001" required value={litres} onChange={event=>{setLitres(event.target.value);setReview(false);}}/></label></div>
      {speechSupported()&&<><label>Voice field<select aria-label="Voice field" value={voiceField} onChange={event=>setVoiceField(event.target.value)}><option value="plate">Vehicle number</option><option value="quantity">Quantity</option><option value="fuel">Fuel</option></select></label><div className="actions"><button type="button" onClick={()=>{voiceStop.current?.();voiceStop.current=speak(text=>{setReview(false);if(voiceField==='plate')setPlate(text.toUpperCase().replace(/\s/g,''));else if(voiceField==='quantity')setLitres(text.match(/\d+(\.\d+)?/)?.[0]??'');else setFuel(catalog.fuels.find(item=>text.toLowerCase().includes(item.name.toLowerCase()))?.id??'');},()=>notify('Microphone unavailable. Use manual entry.'));}}>Start voice</button><button type="button" onClick={()=>voiceStop.current?.()}>Stop voice</button></div></>}
      {review&&<div className="info"><strong>Confirm {plate} · {litres} L</strong><p>Final amount, points and fraud status are calculated by the server. Check all fields before submitting.</p></div>}
      <button className="primary" disabled={busy||scanning}>{busy?'Processing…':review?'Confirm & submit':'Review transaction →'}</button>
    </form>
  </section><section className="panel summary"><p className="eyebrow">02 / SUMMARY</p><h2>{plate||'Vehicle not entered'}</h2><div className="estimate">{price&&litres?money(Math.round(Number(litres)*price)):'₹ —'}</div><p className="muted">Estimated total · price at server acceptance</p><div className="row"><span>Quantity</span><strong>{litres||'—'} L</strong></div><div className="row"><span>Price / litre</span><strong>{price?money(price):'—'}</strong></div><div className="info"><h3>You stay in control</h3><p>Live camera, photo OCR and voice only assist entry. Manual correction and confirmation are always required.</p><p>Offline entries remain pending until the server accepts them.</p></div></section></div>;
}
