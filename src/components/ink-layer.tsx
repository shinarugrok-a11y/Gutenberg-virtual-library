import { useEffect, useRef, useState, type PointerEvent } from "react";
import { eraseNear, type Stroke, type Tool } from "@/lib/notes";

type Live = Stroke | null;

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], width: number, height: number) {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;
    if (stroke.tool === "pencil") {
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = stroke.size;
    } else if (stroke.tool === "brush") {
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = stroke.size * 2.3;
    } else if (stroke.tool === "marker") {
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = stroke.size * 3.6;
    } else {
      ctx.globalAlpha = 0.92;
      ctx.lineWidth = stroke.size;
    }
    ctx.beginPath();
    const first = stroke.points[0]!;
    ctx.moveTo(first.x * width, first.y * height);
    for (let i = 1; i < stroke.points.length; i++) {
      const point = stroke.points[i]!;
      ctx.lineTo(point.x * width, point.y * height);
    }
    ctx.stroke();
    if (stroke.tool === "pencil") {
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(first.x * width + 0.7, first.y * height + 0.4);
      for (let i = 1; i < stroke.points.length; i++) {
        const point = stroke.points[i]!;
        ctx.lineTo(point.x * width + 0.7, point.y * height + 0.4);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function InkLayer({
  active,
  tool,
  color,
  size,
  strokes,
  onChange,
}: {
  active: boolean;
  tool: Tool;
  color: string;
  size: number;
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<Live>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, live ? [...strokes, live] : strokes, rect.width, rect.height);
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [strokes, live]);

  function pointOf(event: PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const wrap = wrapRef.current!;
    const rect = wrap.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (!active) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOf(event);
    if (tool === "eraser") {
      onChange(eraseNear(strokesRef.current, point.x, point.y, size / 180));
      return;
    }
    setLive({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      tool,
      color,
      size,
      points: [point],
    });
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const point = pointOf(event);
    if (tool === "eraser") {
      onChange(eraseNear(strokesRef.current, point.x, point.y, size / 180));
      return;
    }
    setLive((current) => {
      if (!current) return current;
      const last = current.points[current.points.length - 1];
      if (!last) return current;
      const dx = last.x - point.x;
      const dy = last.y - point.y;
      if (dx * dx + dy * dy < 0.000004) return current;
      const jitter = tool === "pencil" ? (Math.random() - 0.5) * 0.004 : 0;
      const next = { x: point.x + jitter, y: point.y + jitter };
      if (current.points.length > 1600) return current;
      return { ...current, points: [...current.points, next] };
    });
  }

  function up() {
    if (tool === "eraser") return;
    setLive((current) => {
      if (current && current.points.length > 1) onChange([...strokesRef.current, current]);
      return null;
    });
  }

  return (
    <div ref={wrapRef} className={`ink-layer${active ? "" : " is-off"}`}>
      <canvas
        ref={canvasRef}
        aria-label="Ink on this page"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  );
}
