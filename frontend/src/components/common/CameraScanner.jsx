import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const NUMERIC = /^\d+$/;

/** Camera barcode scanner dialog. Only numeric codes are accepted. */
export function CameraScanner({ open, onOpenChange, onDetected, testId = "camera" }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;

  useEffect(() => {
    if (!open) return undefined;
    setError("");
    let controls;
    let cancelled = false;
    let done = false;
    const reader = new BrowserMultiFormatReader();
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera is not available (HTTPS required).");
        return;
      }
      // Wait for the dialog's video element to mount
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled || !videoRef.current) return;
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current,
          (result) => {
            const text = result?.getText()?.trim();
            if (done || !text || !NUMERIC.test(text)) return;
            done = true;
            detectedRef.current(text);
            onOpenChange(false);
          },
        );
        if (cancelled) controls.stop();
      } catch (e) {
        setError(e?.name === "NotAllowedError" ? "Camera permission denied." : "Could not start the camera.");
      }
    };
    start();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid={`${testId}-dialog`}>
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>Hold the barcode in front of the camera.</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />
        )}
      </DialogContent>
    </Dialog>
  );
}
