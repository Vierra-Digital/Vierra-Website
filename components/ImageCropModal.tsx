"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { FiX } from "react-icons/fi";
import type { Area } from "@/lib/cropImage";
import { getCroppedImg } from "@/lib/cropImage";
import Modal from "@/components/ui/Modal";

interface ImageCropModalProps {
  imageSrc: string;
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

/**
 * Built on the shared Modal shell, in the same shape as the panel's other dialogs (Invite Staff,
 * Edit Staff, Add Client): one card, a header row with the title and a close button, the body, then
 * a right-aligned Cancel / primary pair.
 *
 * It used to hand-roll its own backdrop and a three-band layout with a grey footer strip, so it was
 * the odd one out — and being hand-rolled it also missed what the shell provides: portalling to
 * body, Escape to close, and a focus trap.
 */
export default function ImageCropModal({ imageSrc, onComplete, onCancel }: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const onCropAreaChange = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) {
      return;
    }
    setIsProcessing(true);
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onComplete(blob);
    } catch (err) {
      console.error("Crop failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      zIndexClass="z-[300]"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 text-[#111827]"
      label="Crop photo"
      // Dragging the crop can end with the pointer outside the card; closing on that would throw
      // the crop away mid-gesture. Escape and the two buttons still close it.
      closeOnBackdrop={false}
      closeOnEscape={!isProcessing}
      onClose={onCancel}
    >
      <header className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">Crop Photo</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="rounded-lg p-2 text-[#6B7280] transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <FiX className="h-5 w-5" />
        </button>
      </header>

      <div className="relative h-[340px] w-full overflow-hidden rounded-xl bg-[#111827]">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          onCropAreaChange={onCropAreaChange}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor="crop-zoom"
          className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598]"
        >
          Zoom
        </label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[#F4F2F8] accent-[#701CC0]"
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="h-9 rounded-[10px] bg-[#F4F2F8] px-3.5 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#EAE6F3] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isProcessing}
          className="h-9 rounded-[10px] bg-[#701CC0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#5f17a5] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? "Processing…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
