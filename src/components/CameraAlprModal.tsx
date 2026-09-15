import React, { useRef, useState } from "react";
import { Camera, ImagePlus, X, RotateCcw } from "lucide-react";
import { soundFx } from "../sound";
import { fastAlprPhoto } from "../fastAlpr";

interface CameraAlprModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (plate: string) => void;
}

/**
 * Plate scanner modal — photo only.
 *
 * Live "always scanning" video was removed: it depended on getUserMedia
 * constraints that failed silently on many phones (black preview box) and
 * added complexity for no real benefit. This flow is simpler and more
 * reliable: take/pick one photo of the plate, run OCR on it, fill the
 * vehicle number field. Typical turnaround is ~1-2s (OCR) plus however long
 * the camera app takes to snap the photo — well inside the 4-10s target.
 */
export const CameraAlprModal: React.FC<CameraAlprModalProps> = ({ isOpen, onClose, onDetected }) => {
  const [status, setStatus] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setStatus(null);
    setIsProcessing(false);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    reset();
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setIsProcessing(true);
    setStatus("Reading plate…");

    try {
      const detected = await fastAlprPhoto(file);
      soundFx.playSuccess();
      onDetected(detected);
      handleClose();
    } catch (error) {
      setIsProcessing(false);
      setStatus(error instanceof Error ? error.message : "Plate unclear. Try again with a straighter, closer shot.");
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    void handleFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white border border-slate-800">
        <div className="px-4 py-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
          <div>
            <span className="font-bold text-sm tracking-wide">Scan Number Plate</span>
            <p className="text-[10px] text-slate-400">Take or upload a photo of the plate</p>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="Captured plate" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Camera className="w-10 h-10" />
              <span className="text-xs">No photo yet</span>
            </div>
          )}

          {isProcessing && (
            <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-emerald-300 font-mono">{status}</span>
              </div>
            </div>
          )}

          {!isProcessing && status && (
            <p className="absolute bottom-3 left-3 right-3 text-center text-[11px] text-rose-200 bg-rose-950/80 px-3 py-1.5 rounded-full">
              {status}
            </p>
          )}
        </div>

        <div className="p-4 bg-slate-950 space-y-2.5">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            {isProcessing ? "Reading…" : previewUrl ? "Retake photo" : "Take photo"}
          </button>

          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={isProcessing}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-2"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Choose from gallery
          </button>

          {status && !isProcessing && (
            <button
              onClick={reset}
              className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try again
            </button>
          )}

          {/* capture="environment" opens the rear camera directly on mobile;
              on desktop browsers this attribute is ignored and it behaves
              like a normal file picker. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleInputChange}
            className="hidden"
          />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleInputChange} className="hidden" />
        </div>
      </div>
    </div>
  );
};
