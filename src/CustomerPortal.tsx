import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api, errorText, money } from "./api";
import { fastAlprFrame } from "./fastAlpr";
import "./customer.css";
import "./scanner.css";

type Entitlement = {
  id: string;
  code: string;
  reward_name: string;
  points_cost: number;
  quantity_ml: number;
  created_at: string;
};

type Result = {
  plate: string;
  balance: string;
  lifetime_points: string;
  history: {
    id: string;
    quantity_ml: number;
    amount_paise: string;
    payment_method: "CASH" | "UPI";
    points: number;
    fraud: boolean;
    created_at: string;
  }[];
  reward: {
    name: string;
    threshold_points: number;
    quantity_ml: number;
    available: Entitlement[];
    points_to_next: number;
  };
};

function RewardQr({ reward, plate }: { reward: Entitlement; plate: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(reward.code, { width: 260, margin: 2, errorCorrectionLevel: "M" }).then(setSrc).catch(() => setSrc(""));
  }, [reward.code]);
  return <article className="reward-qr"><p className="eyebrow">REWARD READY</p><h3>{reward.reward_name}</h3><p><strong>{(reward.quantity_ml / 1000).toFixed(3)} L free fuel</strong></p>{src && <img src={src} alt="Single-use loyalty reward QR" />}<p className="muted">Show this QR to the employee with this vehicle. It works once and must match plate {plate}.</p><code>{reward.code}</code></article>;
}

function openCamera(video: HTMLVideoElement) {
  return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } } }).then((stream) => { video.srcObject = stream; video.muted = true; video.playsInline = true; return video.play().then(() => stream); });
}
function stopCamera(video: HTMLVideoElement | null) { const stream = video?.srcObject as MediaStream | null; if (stream) stream.getTracks().forEach((track) => track.stop()); if (video) { video.pause(); video.srcObject = null; } }

export function CustomerPortal() {
  const [station, setStation] = useState("");
  const [stationName, setStationName] = useState("FuelPulse");
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [tab, setTab] = useState<"POINTS" | "OFFERS" | "NOTIFICATIONS">("POINTS");
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const requested = new URLSearchParams(location.search).get("station")?.trim().toLowerCase();
    void api<{ station: string; name: string }>("/customer/config").then((config) => {
      const selected = requested || localStorage.getItem("fuelpulse-station") || config.station;
      setStation(selected);
      setStationName(config.name);
      if (selected) localStorage.setItem("fuelpulse-station", selected);
    }).catch(() => {
      const saved = localStorage.getItem("fuelpulse-station");
      if (saved) setStation(saved);
    });
  }, []);

  const stop = () => { setScanning(false); stopCamera(video.current); };

  useEffect(() => {
    if (!result?.reward.available.length) return;
    if ("Notification" in window && Notification.permission === "granted") new Notification("FuelPulse reward unlocked", { body: `${result.reward.available.length} reward available for ${result.plate}` });
  }, [result]);

  async function lookup() {
    if (!station) { setError("Station is still loading. Please try again in a moment."); return; }
    setBusy(true); setError("");
    try { const data = await api<Result>("/customer/identify", { station, plate }); setResult(data); stop(); }
    catch (e) { setResult(null); setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function start() {
    stop(); setError(""); setScanning(true); setMessage("Opening rear camera…");
    try {
      if (!video.current) throw new Error("Camera preview unavailable");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Live scanning unavailable; type plate manually");
      await openCamera(video.current);
      const started = Date.now(); const evidence = new Map<string, number>();
      while (Date.now() - started < 10000) {
        setMessage("Scanning… hold steady");
        try {
          const p = await fastAlprFrame(video.current, "/api/customer/alpr");
          const votes = (evidence.get(p) ?? 0) + 1; evidence.set(p, votes);
          setMessage(`Reading ${p}${votes > 1 ? ` (${votes}×)` : ""}`);
          if (votes >= 2) { setPlate(p); setMessage(`Plate read: ${p}. Confirm or edit, then continue.`); stop(); return; }
        } catch { /* continue collecting frames */ }
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      setError("Plate unclear. Move closer, avoid glare, or type it manually."); stop();
    } catch (e) { setError(errorText(e)); stop(); }
  }

  return <main className="customer-page"><section className="panel customer-card">
    <div className="brand"><b>F</b>FuelPulse</div><p className="eyebrow">CUSTOMER · {stationName}</p><h1>Points, offers & updates</h1>
    <div className="actions mode-actions"><button type="button" className={tab === "POINTS" ? "active" : ""} onClick={() => setTab("POINTS")}>Points</button><button type="button" className={tab === "OFFERS" ? "active" : ""} onClick={() => setTab("OFFERS")}>Offers</button><button type="button" className={tab === "NOTIFICATIONS" ? "active" : ""} onClick={() => setTab("NOTIFICATIONS")}>Notifications</button></div>
    {tab === "POINTS" && <>
      <p className="muted">Your station is selected automatically. You can change it if you use more than one FuelPulse station.</p>
      <form onSubmit={(e) => { e.preventDefault(); void lookup(); }}>
        <label>Station ID<input value={station} onChange={(e) => { const v = e.target.value.toLowerCase(); setStation(v); localStorage.setItem("fuelpulse-station", v); }} placeholder="station-id" required /></label>
        <label>Vehicle number<input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="MH12AB1234" required /></label>
        <div className="camera-actions"><button type="button" onClick={start} disabled={scanning || !station}>Scan plate</button>{scanning && <button type="button" onClick={stop}>Stop scanner</button>}<span className="muted">FastALPR uses multiple stable readings.</span></div>
        <div className={scanning ? "plate-camera active" : "plate-camera"}><video ref={video} muted playsInline /><div className="plate-guide"><span>ALIGN NUMBER PLATE</span></div>{scanning && <div className="scan-status"><i />{message}</div>}</div>
        <button className="primary" disabled={busy || !station}>{busy ? "Looking up…" : "View points and transactions"}</button>
      </form>
      <p role="status">{error}</p>
      {result && <div className="customer-summary"><p className="eyebrow">{result.plate}</p><h2>{result.balance} usable points</h2><p className="muted">{result.lifetime_points} lifetime points earned</p>
        {result.reward.available.length > 0 ? <div className="reward-alert" role="alert"><strong>🎉 Loyalty reward unlocked!</strong><p>{result.reward.available.length} single-use reward{result.reward.available.length === 1 ? " is" : "s are"} ready below.</p></div> : <div className="customer-hit"><strong>{result.reward.name}</strong><p>{result.reward.points_to_next} more points to your next {(result.reward.quantity_ml / 1000).toFixed(3)} L free-fuel reward</p><small>One reward for every {result.reward.threshold_points} points</small></div>}
        {result.reward.available.map((reward) => <RewardQr key={reward.id} reward={reward} plate={result.plate} />)}
        <h2>Past transactions</h2>{result.history.length ? result.history.map((t) => <div className="row" key={t.id}><div><strong>{new Date(t.created_at).toLocaleString("en-IN")}</strong><p className="muted">{t.quantity_ml / 1000} L · {t.payment_method} · {t.fraud ? "Flagged" : "Confirmed"}</p></div><div><strong>{money(t.amount_paise)}</strong><p>+{t.points} points</p></div></div>) : <p className="muted">No transactions found for this vehicle at this station.</p>}
      </div>}
    </>}
    {tab === "OFFERS" && <div className="customer-summary"><h2>Offers</h2><p className="muted">Offers will appear here when your station publishes them.</p><div className="empty"><span>🏷️</span><h3>No offers yet</h3><p>Check back later.</p></div></div>}
    {tab === "NOTIFICATIONS" && <div className="customer-summary"><h2>Notifications</h2><p className="muted">Reward and offer updates will show here.</p><div className="empty"><span>🔔</span><h3>No notifications</h3><p>Enable notifications in your browser when prompted.</p></div><button type="button" onClick={async () => { if ("Notification" in window) { const permission = await Notification.requestPermission(); setError(permission === "granted" ? "Notifications enabled" : "Notifications not enabled"); } }}>Enable notifications</button></div>}
    <p style={{ marginTop: 18 }}><a href="/">← Staff sign in</a></p>
  </section></main>;
}
