import React, { useRef, useState, useEffect } from "react";

const CROP_SIZE = 260;

export default function ImageCropModal({ imageSrc, onCrop, onCancel }) {
  const canvasRef = useRef(null);
  const [img] = useState(() => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.src = imageSrc;
    return i;
  });
  const [loaded, setLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);

  // Load image
  useEffect(() => {
    if (img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    } else {
      img.onload = () => setLoaded(true);
    }
  }, [img]);

  // Draw canvas every time loaded / scale / offset changes
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    draw();
  }, [loaded, scale, offset]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Compute draw dimensions
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const baseScale = CROP_SIZE / Math.min(nw, nh);
    const ts = baseScale * scale;
    const dw = nw * ts;
    const dh = nh * ts;
    const dx = (CROP_SIZE - dw) / 2 + offset.x;
    const dy = (CROP_SIZE - dh) / 2 + offset.y;

    // Draw image
    ctx.drawImage(img, dx, dy, dw, dh);

    // Draw a square guide border with red color to indicate crop boundaries
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, CROP_SIZE - 4, CROP_SIZE - 4);
  };

  // ─── Mouse handlers ───
  const handleMouseDown = (e) => {
    e.preventDefault();
    setDrag({ startX: e.clientX, startY: e.clientY, offX: offset.x, offY: offset.y });
  };
  const handleMouseMove = (e) => {
    if (!drag) return;
    setOffset({ x: drag.offX + (e.clientX - drag.startX), y: drag.offY + (e.clientY - drag.startY) });
  };
  const handleMouseUp = () => setDrag(null);
  const handleWheel = (e) => {
    e.preventDefault();
    setScale((s) => Math.max(0.5, Math.min(5, s - e.deltaY * 0.002)));
  };

  // ─── Touch handlers ───
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      setDrag({ startX: t.clientX, startY: t.clientY, offX: offset.x, offY: offset.y });
    }
  };
  const handleTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && drag) {
      const t = e.touches[0];
      setOffset({ x: drag.offX + (t.clientX - drag.startX), y: drag.offY + (t.clientY - drag.startY) });
    }
  };
  const handleTouchEnd = () => setDrag(null);

  // ─── Crop & output ───
  const handleCrop = () => {
    const out = document.createElement("canvas");
    out.width = CROP_SIZE;
    out.height = CROP_SIZE;
    const ctx = out.getContext("2d");

    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const baseScale = CROP_SIZE / Math.min(nw, nh);
    const ts = baseScale * scale;
    const dw = nw * ts;
    const dh = nh * ts;
    const dx = (CROP_SIZE - dw) / 2 + offset.x;
    const dy = (CROP_SIZE - dh) / 2 + offset.y;

    // Draw the image directly on the square canvas output
    ctx.drawImage(img, dx, dy, dw, dh);

    onCrop(out.toDataURL("image/jpeg", 0.92));
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-bold text-sm">Crop Profile Photo</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Hint */}
          <p className="text-center text-xs text-gray-500 font-medium">
            📱 Drag to reposition &nbsp;·&nbsp; Scroll or slider to zoom
          </p>

          {/* Canvas crop area */}
          <div className="flex justify-center">
            {loaded ? (
              <canvas
                ref={canvasRef}
                width={CROP_SIZE}
                height={CROP_SIZE}
                className="rounded-3xl cursor-grab active:cursor-grabbing shadow-xl touch-none select-none border-2 border-gray-100"
                style={{ width: CROP_SIZE, height: CROP_SIZE }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            ) : (
              <div
                style={{ width: CROP_SIZE, height: CROP_SIZE }}
                className="rounded-full bg-gray-100 flex items-center justify-center"
              >
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Zoom slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-gray-600">Zoom</label>
              <span className="text-xs text-gray-400 font-mono">{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.02"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-red-600 h-1.5 rounded-full cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              disabled={!loaded}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-200 transition-colors disabled:opacity-50"
            >
              ✓ Use Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
