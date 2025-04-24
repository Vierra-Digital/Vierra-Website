import React, { useState, useCallback } from 'react';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ["latin"] });

interface PdfUploaderProps {
  onFileSelect: (file: File) => void;
}

const PdfUploader: React.FC<PdfUploaderProps> = ({ onFileSelect }) => {
  const [error, setError] = useState<string | null>(null);
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        onFileSelect(file);
      } else {
        setError('Please select a PDF file.');
      }
    }
  }, [onFileSelect]);

  return (
    <div className="w-full">
      <label
        htmlFor="pdf-upload"
        className={`cursor-pointer inline-block w-full px-4 py-3 bg-[#701CC0] text-white text-center rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-all duration-300 hover:scale-105 hover:bg-[#8F42FF] ${inter.className}`}
      >
        Upload PDF
      </label>
      <input
        id="pdf-upload"
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
    </div>
  );
};

export default PdfUploader;
