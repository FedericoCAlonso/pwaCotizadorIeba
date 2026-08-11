import React, { useEffect, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<Props> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const scanner = new Html5Qrcode("reader", {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE
      ]
    });

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 }
      },
      (decodedText) => {
        if (scanner.isScanning) {
          scanner.stop().then(() => {
            onScan(decodedText);
          }).catch(() => {
            onScan(decodedText);
          });
        } else {
          onScan(decodedText);
        }
      },
      (errorMessage) => {
        // Ignorar errores por frame
      }
    ).catch(err => {
      console.error(err);
      setError('No se pudo acceder a la cámara. Asegúrate de dar permisos o usa HTTPS.');
    });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 flex items-center justify-between border-b border-slate-700/50">
          <h3 className="text-white font-medium flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-500" /> 
            Escanear Código
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <p className="text-slate-300 text-sm max-w-[250px]">{error}</p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center">
              <div id="reader" className="w-full"></div>
            </div>
          )}
          <p className="text-center text-xs text-slate-500 mt-4">
            Apunta la cámara al código de barras o QR del producto.
          </p>
        </div>
      </div>
    </div>
  );
};
