import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, CameraDevice } from 'html5-qrcode';
import { X, Camera, AlertCircle, SwitchCamera, Zap, ZapOff, Image as ImageIcon, Keyboard, ArrowRight } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<Props> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string>('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);
  const [isTorchSupported, setIsTorchSupported] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const isHandledRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar cámaras y scanner
  useEffect(() => {
    let scannerInstance: Html5Qrcode | null = null;

    const initScanner = async () => {
      try {
        // Verificar cámaras disponibles
        const devices = await Html5Qrcode.getCameras();
        setCameras(devices);

        // Elegir cámara trasera por defecto si existe
        let selectedCamId = '';
        if (devices.length > 0) {
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('trasera') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          );
          const camIndex = backCam ? devices.indexOf(backCam) : 0;
          setActiveCameraIndex(camIndex);
          selectedCamId = devices[camIndex].id;
        }

        // Crear instancia de Html5Qrcode con BarcodeDetector habilitado
        scannerInstance = new Html5Qrcode("reader", {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true
          }
        });
        scannerRef.current = scannerInstance;

        const cameraConfig = selectedCamId ? selectedCamId : { facingMode: "environment" };

        await startScanning(scannerInstance, cameraConfig);
      } catch (err: any) {
        console.error("Error iniciando escáner:", err);
        setError('No se pudo acceder a la cámara. Verifique los permisos de cámara en su navegador o asegúrese de usar HTTPS.');
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current) {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          scannerRef.current.stop().catch(console.error);
        }
      }
    };
  }, []);

  const startScanning = async (scanner: Html5Qrcode, cameraConfig: string | MediaTrackConstraints) => {
    setError('');
    try {
      await scanner.start(
        cameraConfig,
        {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // qrbox amplio para asegurar que códigos de barra 1D (EAN-13, CODE-128) entren sin recortar bordes
            const width = Math.floor(viewfinderWidth * 0.85);
            const height = Math.floor(viewfinderHeight * 0.55);
            return {
              width: Math.max(width, 200),
              height: Math.max(height, 100)
            };
          },
          aspectRatio: 1.333333
        },
        (decodedText) => {
          handleSuccessScan(decodedText);
        },
        () => {
          // Ignorar errores frame por frame cuando no se detecta código
        }
      );

      // Comprobar soporte de linterna/flash
      try {
        const capabilities = scanner.getRunningTrackCapabilities() as any;
        if (capabilities && capabilities.torch) {
          setIsTorchSupported(true);
        }
      } catch (e) {
        setIsTorchSupported(false);
      }
    } catch (err: any) {
      console.error("Error al iniciar cámara:", err);
      setError('Error al activar el stream de video. Si usas otra cámara, intenta cambiarla.');
    }
  };

  const handleSuccessScan = async (code: string) => {
    if (isHandledRef.current) return;
    isHandledRef.current = true;

    // Feedback háptico
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(100); } catch (e) {}
    }

    // Detener scanner limpiamente
    if (scannerRef.current && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn("Advertencia al detener scanner:", err);
      }
    }

    onScan(code.trim());
  };

  // Cambiar entre cámaras si hay más de una
  const handleSwitchCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1) return;
    const nextIndex = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIndex);
    setIsTorchOn(false);

    try {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop();
      }
      await startScanning(scannerRef.current, cameras[nextIndex].id);
    } catch (err) {
      console.error("Error cambiando de cámara:", err);
    }
  };

  // Alternar linterna
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !isTorchSupported) return;
    try {
      const newTorchState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setIsTorchOn(newTorchState);
    } catch (err) {
      console.error("Error al cambiar linterna:", err);
    }
  };

  // Escanear archivo desde galería
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5Qrcode = scannerRef.current || new Html5Qrcode("reader");
      const result = await html5Qrcode.scanFile(file, true);
      if (result) {
        handleSuccessScan(result);
      }
    } catch (err) {
      alert('No se pudo detectar ningún código de barras o QR en la imagen seleccionada.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleSuccessScan(manualCode.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4">
      <div className="bg-surface-container border border-outline-variant/30 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl text-on-surface">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-outline-variant/30">
          <h3 className="font-semibold text-on-surface flex items-center gap-2 text-base">
            <Camera className="w-5 h-5 text-primary" /> 
            Escanear Código (1D / QR)
          </h3>
          <button 
            onClick={onClose} 
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-full hover:bg-surface-variant transition-colors"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport / Error */}
        <div className="p-4 space-y-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3 bg-surface-container-low rounded-2xl p-4">
              <AlertCircle className="w-10 h-10 text-error" />
              <p className="text-on-surface-variant text-sm max-w-[280px]">{error}</p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] flex items-center justify-center border border-outline-variant/30">
              <div id="reader" className="w-full h-full [&_video]:object-cover"></div>

              {/* Overlay de encuadre visual */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                <div className="w-[85%] h-[55%] border-2 border-primary/80 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Esquinas destacadas */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-primary rounded-tl-md"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-primary rounded-tr-md"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-primary rounded-bl-md"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-primary rounded-br-md"></div>
                  
                  {/* Línea roja escáner animada */}
                  <div className="w-full h-0.5 bg-primary/90 shadow-[0_0_8px_#3b82f6] animate-pulse absolute top-1/2 -translate-y-1/2"></div>
                </div>
              </div>

              {/* Botones de control sobre el video */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
                {isTorchSupported && (
                  <button
                    onClick={handleToggleTorch}
                    className={`p-2.5 rounded-full backdrop-blur-md transition-all ${isTorchOn ? 'bg-primary text-on-primary' : 'bg-slate-900/70 text-white hover:bg-slate-800'}`}
                    title={isTorchOn ? 'Apagar linterna' : 'Encender linterna'}
                  >
                    {isTorchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                  </button>
                )}

                {cameras.length > 1 && (
                  <button
                    onClick={handleSwitchCamera}
                    className="p-2.5 rounded-full bg-slate-900/70 backdrop-blur-md text-white hover:bg-slate-800 transition-all"
                    title="Cambiar cámara"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Opciones auxiliares: Galería e ingreso manual */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-outline-variant/20">
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileChange} 
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Desde foto</span>
            </button>

            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>{showManualInput ? 'Ocultar teclado' : 'Ingresar código manual'}</span>
            </button>
          </div>

          {/* Input manual desplegable */}
          {showManualInput && (
            <form onSubmit={handleManualSubmit} className="flex gap-2 pt-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Código SKU / EAN / QR..."
                className="flex-1 bg-surface-container-highest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold rounded-xl flex items-center justify-center gap-1 transition-all"
              >
                <span>Usar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          <p className="text-center text-xs text-on-surface-variant">
            Soporta códigos de barras EAN-13, EAN-8, CODE-128, CODE-39, UPC y QR.
          </p>
        </div>
      </div>
    </div>
  );
};
