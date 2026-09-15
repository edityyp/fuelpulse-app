import React, { useEffect, useRef, useState } from "react";
import { Camera, X, Zap } from "lucide-react";
import { soundFx } from "../sound";
import { fastAlprFrame, fastAlprPhoto } from "../fastAlpr";

interface CameraAlprModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (plate: string) => void;
}

// Tried first; strict enough for a good read, loose enough that most rear
// cameras can actually satisfy it.
const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

// Fallback used only if the browser rejects the constraints above
// (OverconstrainedError) - this is what was silently leaving the black box
// on devices whose rear camera can't hit 1280x720+.
const FALLBACK_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" } },
};

// How often we try a fresh OCR read while the camera is open.
const SCAN_INTERVAL_MS = 500;

export const CameraAlprModal: React.FC<CameraAlprModalProps> = ({ isOpen, onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState("Scanning… hold the plate steady");
  const [isProcessing, setIsProcessing] = useState(false);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settled = useRef(false); // guards against double-fire once a plate is found

  useEffect(() => {
    if (!isOpen) {
      stream?.getTracks().forEach((track) => track.stop());
      setStream(null);
      return;
    }

    soundFx.playTap();
    settled.current = false;
    let active: MediaStream | null = null;
    let cancelled = false;

    const startAutoScan = () => {
      const tick = async () => {
        if (cancelled || settled.current) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const detected = await fastAlprFrame(video);
            if (!cancelled && !settled.current) {
              settled.current = true;
              soundFx.playSuccess();
              setStatus(`Plate found: ${detected}`);
              onDetected(detected);
              onClose();
              return; // stop the loop - modal is closing
            }
          } catch {
            // No confident plate yet this frame - keep scanning silently.
            // The status message stays put so the UI doesn't flicker every 500ms.
          }
        }
        scanTimer.current = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      scanTimer.current = setTimeout(tick, SCAN_INTERVAL_MS);
    };

    const openCamera = async (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints);

    const init = async () => {
      let media: MediaStream;
      try {
        media = await openCamera(PREFERRED_CONSTRAINTS);
      } catch {
        try {
          media = await openCamera(FALLBACK_CONSTRAINTS);
        } catch {
          if (!cancelled) setStatus("Camera unavailable — upload a clear plate photo");
          return;
        }
      }

      if (cancelled) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }

      active = media;
      setStream(media);

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = media;
      video.muted = true;
      video.playsInline = true;

      try {
        await video.play();
      } catch {
        if (!cancelled) setStatus("Tap the preview to start the camera");
        return;
      }

      if (cancelled) return;
      setStatus("Align the full plate inside the guide — reading automatically…");
      startAutoScan();
    };

    void init();
    return () => {
      cancelled = true;
      if (scanTimer.current) clearTimeout(scanTimer.current);
      active?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsProcessing(true);
    setStatus("Reading the complete plate from photo…");
    try {
      const detected = await fastAlprPhoto(file);
      settled.current = true;
      soundFx.playSuccess();
      onDetected(detected);
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Plate unclear. Retake the photo.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white border border-slate-800">
        <div className="px-4 py-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
          <div>
            <span className="font-bold text-sm tracking-wide">FastALPR Plate Scanner</span>
            <p className="text-[10px] text-slate-400">Auto-captures the instant a plate is readable</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div className="relative w-11/12 h-28 border-2 border-emerald-400/80 rounded-xl flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.35)] bg-slate-950/10">
              <div className="absolute left-0 right-0 h-0.5 bg-emerald-400/80 laser-line" />
              <span className="text-[11px] font-mono tracking-widest text-emerald-300 uppercase bg-slate-950/80 px-2.5 py-1 rounded border border-emerald-400/30">
                KEEP ALL CHARACTERS INSIDE
              </span>
            </div>
            <p className="text-[11px] text-slate-200 mt-3 bg-black/70 px-3 py-1 rounded-full">{status}</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-sky-400" /> Auto-scanning</span>
            <span className="text-emerald-400 font-bold">{stream ? "LIVE" : "STARTING"}</span>
          </div>

          <label className="block w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs text-center cursor-pointer">
            <span className="inline-flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />
              {isProcessing ? "Reading photo…" : "Or upload a clear plate photo"}
            </span>
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={isProcessing} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
