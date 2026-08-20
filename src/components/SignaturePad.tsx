import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { RotateCcw, PenTool, CheckCircle2 } from 'lucide-react';

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string | null;
}

interface SignaturePadProps {
  onEnd?: () => void;
  height?: number;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(({ onEnd, height = 180 }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Resize canvas to match display size with high DPI compensation
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Save previous drawing if any
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx && canvas.width > 0 && canvas.height > 0) {
      tempCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a'; // Deep ink color
      ctx.lineWidth = 2.8;

      // Restore
      if (tempCanvas.width > 0 && tempCanvas.height > 0) {
        ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
      }
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const coords = getCoordinates(e);
    setIsDrawing(true);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
    setHasSignature(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentCoords = getCoordinates(e);
    const lastCoords = lastPointRef.current;

    ctx.beginPath();
    ctx.moveTo(lastCoords.x, lastCoords.y);
    // Smooth quadratic curve interpolation
    const midX = (lastCoords.x + currentCoords.x) / 2;
    const midY = (lastCoords.y + currentCoords.y) / 2;
    ctx.quadraticCurveTo(lastCoords.x, lastCoords.y, midX, midY);
    ctx.lineTo(currentCoords.x, currentCoords.y);
    ctx.stroke();

    lastPointRef.current = currentCoords;
    setHasSignature(true);
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
    setIsDrawing(false);
    lastPointRef.current = null;
    if (onEnd) onEnd();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const isEmpty = () => {
    return !hasSignature;
  };

  const toDataURL = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty,
    toDataURL
  }));

  return (
    <div className="signature-pad-container">
      <div className="signature-header">
        <div className="signature-title-wrapper">
          <PenTool size={16} className="text-primary" />
          <span className="signature-title">자필 전자서명 (정자 또는 서명)</span>
          {hasSignature && (
            <span className="signature-badge">
              <CheckCircle2 size={13} />
              서명 완료
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          className="btn-clear-signature"
          title="서명 지우기"
        >
          <RotateCcw size={14} />
          다시 쓰기
        </button>
      </div>

      <div className="canvas-wrapper" style={{ height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          className="signature-canvas"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          style={{ touchAction: 'none' }}
        />
        {!hasSignature && (
          <div className="signature-placeholder">
            <span className="placeholder-text">이곳에 펜이나 손가락으로 정자 서명해 주세요</span>
            <div className="signature-baseline" />
          </div>
        )}
      </div>
      <p className="signature-hint">※ 본 서명은 본인 확인 및 전자문서 서명 효력을 지닙니다.</p>
    </div>
  );
});

SignaturePad.displayName = 'SignaturePad';
