import React, { useEffect, useRef, useState } from "react";
import { Camera, X, Zap } from "lucide-react";
import { soundFx } from "../sound";
import { fastAlprFrame, fastAlprPhoto } from "../fastAlpr";

interface CameraAlprModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (plate: string) => void;
}

export const CameraAlprModal: React.FC<CameraAlprModalProps> = ({ isOpen, onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState("Scanning… hold the plate steady");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stream?.getTracks().forEach((track) => track.stop());
      setStream(null);
      return;
    }

    soundFx.playTap();
    let active: MediaStream | null = null;
    let cancelled = false;

    const init = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        active = media;
        setStream(media);
        if (videoRef.current) {
          videoRef.current.srcObject = media;
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          await videoRef.current.play();
        }
        setStatus("Align the full plate inside the guide");
      } catch {
        setStatus("Camera unavailable — upload a clear plate photo");
      }
    };

    void init();
    return () => {
      cancelled = true;
      active?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || !stream) {
      setStatus("Camera is not ready yet");
      return;
    }

    setIsProcessing(true);
    setStatus("Reading every plate character… keep steady");
    soundFx.playScan();

    try {
      // fastAlprFrame now requires repeated, compatible OCR evidence before it
      // can return a plate, so a partial one-frame read cannot be accepted.
      const started = Date.now();
      let detected: string | undefined;
      while (Date.now() - started < 10000 && !detected) {
        try {
          detected = await fastAlprFrame(video);
        } catch {
          setStatus("Reading… move closer, reduce glare, keep all characters visible");
        }
        if (!detected) await new Promise((resolve) => setTimeout(resolve, 450));
      }

      if (!detected) throw Error("Complete plate not readable. Retake with all characters visible.");
      soundFx.playSuccess();
      onDetected(detected);
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Complete plate not readable");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsProcessing(true);
    setStatus("Reading the complete plate from photo…");
    try {
      const detected = await fastAlprPhoto(file);
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
            <p className="text-[10px] text-slate-400">Complete-character verification enabled</p>
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
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-sky-400" /> Multi-frame OCR</span>
            <span className="text-emerald-400 font-bold">{isProcessing ? "READING" : "READY"}</span>
          </div>

          <button
            onClick={handleCapture}
            disabled={isProcessing || !stream}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            {isProcessing ? "Reading complete plate…" : "Scan complete plate"}
          </button>

          <label className="block w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold text-xs text-center cursor-pointer">
            Upload clear plate photo
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} disabled={isProcessing} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
