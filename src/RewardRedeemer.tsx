import { useEffect, useRef, useState } from "react";
import { rewardCode } from "../shared/contracts";
import { api, errorText } from "./api";
import { fastAlprFrame } from "./fastAlpr";

type Reward = { id: string; name: string; quantity_ml: number; created_at: string };

/**
 * RewardRedeemer lets staff redeem a loyalty reward via three paths:
 *
 *  1. QR scan  – customer presents their single-use QR; staff scans it.
 *  2. Manual   – staff types the FPR1:… code shown on the customer's screen.
 *  3. Photo    – staff takes a photo of the vehicle plate; FastALPR detects
 *               the plate and the server redeems the oldest reward for that
 *               vehicle directly (no QR / code needed).  The detected plate
 *               must match the transaction plate before submission.
 */
export function RewardRedeemer({
  plate,
  pump,
  fuel,
  rewards,
  notify,
  onRedeemed,
}: {
  plate: string;
  pump: string;
  fuel: string;
  rewards: Reward[];
  notify: (message: string) => void;
  onRedeemed: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // QR camera state
  const [qrScanning, setQrScanning] = useState(false);
  const qrVideo = useRef<HTMLVideoElement>(null);
  const qrControls = useRef<{ stop(): void } | undefined>(undefined);

  // Plate-photo camera state
  const [plateScanning, setPlateScanning] = useState(false);
  const [detectedPlate, setDetectedPlate] = useState<string | null>(null);
  const plateVideo = useRef<HTMLVideoElement>(null);
  const plateStream = useRef<MediaStream | undefined>(undefined);

  function stopQr() {
    qrControls.current?.stop();
    qrControls.current = undefined;
    setQrScanning(false);
  }

  function stopPlate() {
    plateStream.current?.getTracks().forEach((t) => t.stop());
    plateStream.current = undefined;
    setPlateScanning(false);
  }

  useEffect(
    () => () => {
      stopQr();
      stopPlate();
    },
    [],
  );

  if (!rewards.length) return null;
  const first = rewards[0];

  // ── QR path ──────────────────────────────────────────────────────────────
  async function startQr() {
    stopPlate();
    setQrScanning(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      if (!qrVideo.current) throw Error("QR camera unavailable");
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      qrControls.current = await reader.decodeFromVideoDevice(
        undefined,
        qrVideo.current,
        (result) => {
          if (!result) return;
          const parsed = rewardCode.safeParse(result.getText());
          if (parsed.success) {
            setCode(parsed.data);
            stopQr();
            notify("Reward QR scanned. Confirm only after dispensing the free fuel.");
          }
        },
      );
    } catch (error) {
      stopQr();
      notify(errorText(error));
    }
  }

  async function redeemByCode() {
    const parsed = rewardCode.safeParse(code);
    if (!parsed.success) {
      notify("Scan or enter a valid FuelPulse reward QR");
      return;
    }
    if (!pump || !fuel) {
      notify("Choose the pump and fuel before redeeming");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ reward_name: string; quantity_ml: number }>(
        "/rewards/redeem",
        { code: parsed.data, plate, pump_id: pump, fuel_id: fuel },
      );
      notify(
        `${result.reward_name} redeemed: ${(result.quantity_ml / 1000).toFixed(3)} L free fuel recorded`,
      );
      setCode("");
      await onRedeemed();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  // ── Plate-photo path ──────────────────────────────────────────────────────
  async function startPlateCamera() {
    stopQr();
    setDetectedPlate(null);
    setPlateScanning(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    try {
      if (!plateVideo.current) throw Error("Plate camera unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      plateStream.current = stream;
      plateVideo.current.srcObject = stream;
      await plateVideo.current.play();
    } catch (error) {
      stopPlate();
      notify(errorText(error));
    }
  }

  async function captureAndDetect() {
    if (!plateVideo.current) return;
    setBusy(true);
    try {
      const found = await fastAlprFrame(plateVideo.current);
      setDetectedPlate(found);
      stopPlate();
      if (found !== plate) {
        notify(
          `Plate detected: ${found}. This differs from the transaction plate (${plate}). Verify before redeeming.`,
        );
      } else {
        notify(`Plate confirmed: ${found}. Choose pump & fuel then tap Redeem by plate.`);
      }
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function redeemByPlate() {
    if (!detectedPlate) {
      notify("Capture a plate photo first");
      return;
    }
    if (!pump || !fuel) {
      notify("Choose the pump and fuel before redeeming");
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ reward_name: string; quantity_ml: number }>(
        "/rewards/redeem-by-plate",
        { plate: detectedPlate, pump_id: pump, fuel_id: fuel },
      );
      notify(
        `${result.reward_name} redeemed by plate photo: ${(result.quantity_ml / 1000).toFixed(3)} L free fuel recorded`,
      );
      setDetectedPlate(null);
      await onRedeemed();
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reward-staff">
      <p className="eyebrow">LOYALTY REWARD AVAILABLE</p>
      <h3>{first.name}</h3>
      <p>
        <strong>{(first.quantity_ml / 1000).toFixed(3)} L free fuel</strong> ·{" "}
        {rewards.length} available
      </p>

      {/* ── QR / code path ── */}
      <p className="muted">
        Scan the customer's QR, enter the code, <em>or</em> take a plate photo below.
      </p>
      <div className={qrScanning ? "plate-camera active" : "plate-camera"}>
        <video ref={qrVideo} muted playsInline />
        <div className="plate-guide">
          <span>ALIGN REWARD QR</span>
        </div>
      </div>
      <div className="camera-actions">
        <button type="button" onClick={qrScanning ? stopQr : startQr}>
          {qrScanning ? "Stop QR scanner" : "Scan customer reward QR"}
        </button>
        <input
          aria-label="Reward code"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          placeholder="Or enter reward code"
        />
      </div>
      <button
        type="button"
        className="primary"
        disabled={busy || !code || !pump || !fuel}
        onClick={redeemByCode}
      >
        {busy ? "Redeeming\u2026" : "Confirm free-fuel redemption"}
      </button>

      {/* ── Plate-photo path ── */}
      <hr />
      <p className="eyebrow">OR REDEEM BY PLATE PHOTO</p>
      <p className="muted">
        Point the camera at the vehicle plate. FastALPR detects the number —
        no QR code needed.
      </p>

      {plateScanning && (
        <div className="plate-camera active">
          <video ref={plateVideo} muted playsInline />
          <div className="plate-guide">
            <span>AIM AT VEHICLE PLATE</span>
          </div>
        </div>
      )}
      {!plateScanning && !detectedPlate && (
        <div className="plate-camera">
          <video ref={plateVideo} muted playsInline style={{ display: "none" }} />
        </div>
      )}

      <div className="camera-actions">
        <button
          type="button"
          onClick={plateScanning ? stopPlate : startPlateCamera}
          disabled={busy}
        >
          {plateScanning ? "Stop camera" : "Open plate camera"}
        </button>
        {plateScanning && (
          <button type="button" onClick={captureAndDetect} disabled={busy}>
            {busy ? "Detecting\u2026" : "Capture & detect plate"}
          </button>
        )}
      </div>

      {detectedPlate && (
        <div className="info">
          <strong>Detected plate: {detectedPlate}</strong>
          {detectedPlate !== plate && (
            <p className="muted">
              \u26a0\ufe0f Does not match transaction plate {plate}. Verify before redeeming.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setDetectedPlate(null);
              startPlateCamera();
            }}
          >
            Retake photo
          </button>
        </div>
      )}

      <button
        type="button"
        className="primary"
        disabled={busy || !detectedPlate || !pump || !fuel}
        onClick={redeemByPlate}
      >
        {busy
          ? "Redeeming\u2026"
          : detectedPlate
            ? `Redeem reward for ${detectedPlate}`
            : "Capture plate to redeem"}
      </button>
    </div>
  );
}
