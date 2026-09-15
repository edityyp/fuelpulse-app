import { useEffect, useRef, useState } from "react";
import { transaction, type Catalog, type Input } from "../shared/contracts";
import { money, errorText } from "./api";
import { RewardRedeemer } from "./RewardRedeemer";
import { ocr, scanPlate, speak, speechSupported, type PlateScanner } from "./assist";
import "./scanner.css";
import "./customer.css";

type VehicleLookup = {
  registered: boolean;
  plate: string;
  name?: string;
  masked_phone?: string;
  balance?: string;
  last_visit?: string | null;
  rewards: { id: string; name: string; quantity_ml: number; created_at: string }[];
};

export function TransactionForm({ catalog, save, notify, lookup }: {
  catalog: Catalog;
  save: (value: Input) => Promise<void>;
  notify: (message: string) => void;
  lookup: (plate: string) => Promise<VehicleLookup>;
}) {
  const [pump, setPump] = useState("");
  const [fuel, setFuel] = useState("");
  const [plate, setPlate] = useState("");
  const [value, setValue] = useState("");
  const [entry, setEntry] = useState<"LITRES" | "AMOUNT">("LITRES");
  const [payment, setPayment] = useState<"CASH" | "UPI">("CASH");
  const [plateMode, setPlateMode] = useState<"SCAN" | "MANUAL">("SCAN");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("Ready for camera OCR");
  const [customer, setCustomer] = useState<VehicleLookup | null>(null);
  const [key, setKey] = useState(crypto.randomUUID());
  const [voiceField, setVoiceField] = useState("plate");
  const voiceStop = useRef<(() => void) | undefined>(undefined);
  const scanner = useRef<PlateScanner | undefined>(undefined);
  const video = useRef<HTMLVideoElement>(null);

  const stopCamera = () => {
    scanner.current?.stop();
    scanner.current = undefined;
    setScanning(false);
    const stream = video.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (video.current) {
      video.current.pause();
      video.current.srcObject = null;
    }
  };

  useEffect(() => () => {
    voiceStop.current?.();
    stopCamera();
  }, []);

  const price = catalog.fuels.find((item) => item.id === fuel)?.price_paise;

  const lookupPlate = async (v: string) => {
    try { setCustomer(await lookup(v)); } catch { setCustomer(null); }
  };

  const detected = (v: string) => {
    const normalized = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setPlate(normalized);
    setReview(false);
    void lookupPlate(normalized);
  };

  const startScanner = async () => {
    stopCamera();
    setScanMessage("Opening rear camera for text OCR…");
    setScanning(true);
    setBusy(true);
    setReview(false);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      if (!video.current) throw Error("Camera preview unavailable");
      scanner.current = await scanPlate(
        video.current,
        (v) => {
          detected(v);
          notify(`Plate ${v} detected by OCR. Check it before confirming.`);
          stopCamera();
        },
        (message) => {
          notify(message);
          stopCamera();
        },
        setScanMessage,
      );
      setScanMessage("Scanning plate text…");
    } catch (error) {
      stopCamera();
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const amountPaise = entry === "AMOUNT"
    ? Math.round(Number(value) * 100)
    : price ? Math.round(Number(value) * price) : 0;
  const quantityMl = entry === "LITRES"
    ? Math.round(Number(value) * 1000)
    : price ? Math.round((amountPaise * 1000) / price) : 0;

  return <div className="grid">
    <section className="panel">
      <p className="eyebrow">01 / FILL DETAILS</p>
      <h2>Record a fuel transaction</h2>
      <form onSubmit={async (event) => {
        event.preventDefault();
        try {
          const input = transaction.parse({
            idempotency_key: key,
            pump_id: pump,
            fuel_id: fuel,
            plate,
            payment_method: payment,
            ...(entry === "LITRES" ? { quantity_ml: quantityMl } : { requested_amount_paise: amountPaise }),
          });
          if (!review) { setReview(true); return; }
          setBusy(true);
          await save(input);
          setPlate("");
          setCustomer(null);
          setValue("");
          setReview(false);
          setKey(crypto.randomUUID());
        } catch (error) {
          notify(errorText(error));
        } finally { setBusy(false); }
      }}>
        <label>
          Pump
          <select aria-label="Pump" required value={pump} onChange={(event) => { setPump(event.target.value); setFuel(""); setReview(false); }}>
            <option value="">Choose pump</option>
            {catalog.pumps.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <div className="actions mode-actions">
          <button type="button" className={plateMode === "SCAN" ? "active" : ""} onClick={() => setPlateMode("SCAN")}>Scan plate</button>
          <button type="button" className={plateMode === "MANUAL" ? "active" : ""} onClick={() => { stopCamera(); setPlateMode("MANUAL"); }}>Enter manually</button>
        </div>

        <label>
          Vehicle number
          <input required maxLength={20} value={plate} placeholder="MH12AB1234" onChange={(event) => { setPlate(event.target.value.toUpperCase()); setCustomer(null); setReview(false); }} onBlur={() => { if (plate) void lookupPlate(plate); }} />
        </label>

        {plateMode === "SCAN" && <>
          <div className="camera-actions">
            <button type="button" onClick={scanning ? stopCamera : startScanner} disabled={busy}>
              {busy ? "Starting camera…" : scanning ? "Stop text OCR scanner" : "Start AI text scanner"}
            </button>
            <span className="muted">Free on-device OCR. Keep the complete plate centred and reduce glare.</span>
          </div>

          <div className={`plate-camera ${scanning ? "active" : ""}`} aria-hidden={!scanning}>
            <video ref={video} muted playsInline />
            <div className="plate-guide"><span>FILL THE FRAME WITH THE PLATE</span></div>
            {scanning && <div className="scan-status" role="status"><i />{scanMessage}</div>}
          </div>

          <label className="upload">
            Upload plate photo
            <input type="file" accept="image/*" capture="environment" disabled={busy || scanning} onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                detected(await ocr(file));
                notify("Plate detected with on-device OCR. Check it before confirming.");
              } catch (error) {
                notify(errorText(error));
              } finally {
                setBusy(false);
                event.target.value = "";
              }
            }} />
            <span className="muted">On-device text OCR with multiple image enhancements.</span>
          </label>
        </>}

        {plateMode === "MANUAL" && <div className="info"><strong>Manual entry enabled</strong><p>Type the vehicle number and fill details below.</p></div>}

        {customer?.registered && <div className="customer-hit">
          <strong>{customer.name}</strong>
          <p>{customer.masked_phone} · {customer.balance} points</p>
          <p className="muted">{customer.last_visit ? `Last visit ${new Date(customer.last_visit).toLocaleString("en-IN")}` : "No previous visit"}</p>
        </div>}

        {customer && <RewardRedeemer plate={plate} pump={pump} fuel={fuel} rewards={customer.rewards ?? []} notify={notify} onRedeemed={() => lookupPlate(plate)} />}

        <div className="two">
          <label>
            Fuel
            <select aria-label="Fuel" required value={fuel} onChange={(event) => { setFuel(event.target.value); setReview(false); }}>
              <option value="">Choose fuel</option>
              {catalog.fuels.filter((item) => catalog.links.some((link) => link.pump_id === pump && link.fuel_id === item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>
            Payment method
            <select aria-label="Payment method" value={payment} onChange={(event) => { setPayment(event.target.value as "CASH" | "UPI"); setReview(false); }}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
            </select>
          </label>
        </div>

        <div className="actions mode-actions">
          <button type="button" className={entry === "LITRES" ? "active" : ""} onClick={() => { setEntry("LITRES"); setValue(""); setReview(false); }}>Enter litres</button>
          <button type="button" className={entry === "AMOUNT" ? "active" : ""} onClick={() => { setEntry("AMOUNT"); setValue(""); setReview(false); }}>Enter amount (₹)</button>
        </div>

        <label>
          {entry === "LITRES" ? "Quantity (litres)" : "Customer amount (₹)"}
          <input aria-label={entry === "LITRES" ? "Quantity (litres)" : "Customer amount (₹)"} type="number" min={entry === "LITRES" ? "0.1" : "1"} max={entry === "LITRES" ? "2000" : "1000000"} step={entry === "LITRES" ? "0.001" : "0.01"} required value={value} onChange={(event) => { setValue(event.target.value); setReview(false); }} />
        </label>

        {speechSupported() && <>
          <label>Voice field
            <select aria-label="Voice field" value={voiceField} onChange={(event) => setVoiceField(event.target.value)}>
              <option value="plate">Vehicle number</option>
              <option value="value">Litres or amount</option>
            </select>
          </label>
          <div className="actions">
            <button type="button" onClick={() => { voiceStop.current?.(); voiceStop.current = speak((text) => { setReview(false); if (voiceField === "plate") { const v = text.toUpperCase().replace(/\s/g, ""); setPlate(v); void lookupPlate(v); } else { setValue(text.match(/\d+(\.\d+)?/)?.[0] ?? ""); } }, () => notify("Microphone unavailable. Use manual entry.")); }}>Start voice</button>
            <button type="button" onClick={() => voiceStop.current?.()}>Stop voice</button>
          </div>
        </>}

        {review && <div className="info"><strong>Confirm {plate} · {quantityMl / 1000} L · {money(amountPaise)} · {payment}</strong><p>Price, litres, amount, points, and fraud status are verified by the server.</p></div>}
        <button className="primary" disabled={busy || scanning}>{busy ? "Processing…" : review ? "Confirm & submit" : "Review transaction →"}</button>
      </form>
    </section>

    <section className="panel summary">
      <p className="eyebrow">02 / SUMMARY</p>
      <h2>{plate || "Vehicle not entered"}</h2>
      <div className="estimate">{value && price ? money(amountPaise) : "₹ —"}</div>
      <p className="muted">Server-authoritative estimate</p>
      <div className="row"><span>Quantity</span><strong>{value && price ? (quantityMl / 1000).toFixed(3) : "—"} L</strong></div>
      <div className="row"><span>Price / litre</span><strong>{price ? money(price) : "—"}</strong></div>
      <div className="row"><span>Payment</span><strong>{payment}</strong></div>
      <div className="info">
        <h3>AI text scanning</h3>
        <p>Vehicle plates are read locally in the browser with free Tesseract OCR, image enhancement, Indian plate validation, and multi-frame confirmation. No FastALPR service is used.</p>
      </div>
    </section>
  </div>;
}
