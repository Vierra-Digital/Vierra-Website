"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "@/lib/cropImage";
import { getCroppedImg } from "@/lib/cropImage";
import { X } from "lucide-react";

interface ImageCropModalProps {
  imageSrc: string;
  onComplete: (blob: Blob) => void;
  onCancel: () => void;
}

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
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-lg flex flex-col bg-white rounded-2xl shadow-2xl border border-[#E5E7EB] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - matches Password modal */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">Crop Photo</h2>
            <p className="text-sm text-[#6B7280] mt-0.5">Adjust the crop area for your profile photo.</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-[#6B7280] hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop area */}
        <div className="relative h-[400px] w-full bg-[#111827]">
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

        {/* Content - Zoom slider */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#701CC0]"
            />
          </div>
        </div>

        {/* Footer - matches Password modal */}
        <div className="px-6 py-4 bg-[#F9FAFB] border-t border-[#E5E7EB] rounded-b-2xl flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2.5 border border-[#E5E7EB] rounded-xl text-[#374151] hover:bg-[#F3F4F6] text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isProcessing}
            className="px-4 py-2.5 bg-[#701CC0] text-white rounded-xl hover:bg-[#5f17a5] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Processing..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
