import { useEffect, useRef, useState, type PointerEvent } from "react";
import { eraseNear, type Stroke, type Tool } from "@/lib/notes";

type Live = (Omit<Stroke, "tool"> & { tool: Tool }) | null;
// Shared across page instances, including a page turn immediately after pen use.
let penActive = false;
let penUsedAt = 0;

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
  onTurn,
}: {
  active: boolean;
  tool: Tool;
  color: string;
  size: number;
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  onTurn: (dir: 1 | -1) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [live, renderLive] = useState<Live>(null);
  const liveRef = useRef<Live>(null);
  function setLive(value: Live) { liveRef.current = value; renderLive(value); }
  const drawing = useRef<number | null>(null);
  const touches = useRef(new Set<number>());
  const multiTouch = useRef(false);
  const edge = useRef<{ id: number; x: number; y: number } | null>(null);
  const turnRef = useRef(onTurn);
  turnRef.current = onTurn;

  // Pointer preventDefault alone does not suppress browser touch panning. Keep
  // native multi-touch enabled and suppress only an accepted drawing finger.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const start = (event: TouchEvent) => {
      if (penActive || Date.now() - penUsedAt < 500) return;
      if (event.touches.length > 1) {
        multiTouch.current = true;
        drawing.current = null;
        edge.current = null;
        setLive(null);
      }
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length === 1 && !multiTouch.current && drawing.current !== null) event.preventDefault();
    };
    const end = (event: TouchEvent) => {
      const swipe = edge.current;
      if (swipe && !multiTouch.current && event.touches.length === 0) {
        const touch = event.changedTouches[0];
        if (touch) finishSwipe(touch.clientX, touch.clientY);
      }
      if (!event.touches.length) { multiTouch.current = false; touches.current.clear(); }
    };
    canvas.addEventListener("touchstart", start, { passive: true });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    const abort = () => { edge.current = null; touches.current.clear(); multiTouch.current = false; drawing.current = null; setLive(null); };
    canvas.addEventListener("touchcancel", abort);
    return () => {
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
      canvas.removeEventListener("touchcancel", abort);
    };
  }, []);

  function finishSwipe(x: number, y: number) {
    const swipe = edge.current;
    edge.current = null;
    if (!swipe) return;
    const dx = x - swipe.x;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(y - swipe.y) * 1.5) turnRef.current(dx < 0 ? 1 : -1);
  }
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
      paint(ctx, live && live.tool !== "eraser" ? [...strokes, live as Stroke] : strokes, rect.width, rect.height);
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
    if (event.pointerType === "pen") {
      penActive = true;
      penUsedAt = Date.now();
      drawing.current = null;
      setLive(null);
    }
    if (event.pointerType === "touch") {
      if (penActive || Date.now() - penUsedAt < 500 || event.width > 40 || event.height > 40) return;
      touches.current.add(event.pointerId);
      if (touches.current.size > 1) {
        multiTouch.current = true;
        drawing.current = null;
        edge.current = null;
        setLive(null);
      }
      if (multiTouch.current) return;
      const inner = wrapRef.current!.parentElement!;
      const rect = inner.getBoundingClientRect();
      const style = getComputedStyle(inner);
      const left = Math.max(24, parseFloat(style.paddingLeft));
      const right = Math.max(24, parseFloat(style.paddingRight));
      if (event.clientX < rect.left + 24 || event.clientX > rect.right - 24) {
        edge.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        return;
      }
      if (event.clientX < rect.left + left || event.clientX > rect.right - right ||
          event.clientY < rect.top + Math.max(24, parseFloat(style.paddingTop)) ||
          event.clientY > rect.bottom - Math.max(24, parseFloat(style.paddingBottom))) return;
    }
    if (drawing.current !== null || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    drawing.current = event.pointerId;
    if (event.nativeEvent.isTrusted) event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "eraser" && event.pointerType !== "touch") {
      const point = pointOf(event);
      onChange(eraseNear(strokesRef.current, point.x, point.y, size / 180));
    }
    setLive({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      tool, color, size, points: [pointOf(event)],
    });
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!active || drawing.current !== event.pointerId) return;
    if (event.pointerType === "touch" && (event.width > 40 || event.height > 40 || penActive || Date.now() - penUsedAt < 500)) {
      drawing.current = null;
      setLive(null);
      return;
    }
    event.preventDefault();
    if (event.pointerType === "pen") penUsedAt = Date.now();
    const current = liveRef.current;
    if (!current) return;
    const point = pointOf(event);
    if (current.tool === "eraser" && event.pointerType !== "touch") {
      onChange(eraseNear(strokesRef.current, point.x, point.y, size / 180));
      return;
    }
    const last = current.points[current.points.length - 1]!;
    if ((last.x - point.x) ** 2 + (last.y - point.y) ** 2 < 0.000004 || current.points.length > 1600) return;
    const jitter = tool === "pencil" ? (Math.random() - 0.5) * 0.004 : 0;
    setLive({ ...current, points: [...current.points, { x: point.x + jitter, y: point.y + jitter }] });
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "pen") { penActive = false; penUsedAt = Date.now(); }
    touches.current.delete(event.pointerId);
    if (edge.current?.id === event.pointerId && !multiTouch.current) finishSwipe(event.clientX, event.clientY);
    if (drawing.current === event.pointerId) {
      const current = liveRef.current;
      if (current && (current.points.length > 1 || current.tool === "eraser")) {
        if (current.tool === "eraser") {
          let next = strokesRef.current;
          for (const point of current.points) next = eraseNear(next, point.x, point.y, size / 180);
          onChange(next);
        } else onChange([...strokesRef.current, current as Stroke]);
      }
      drawing.current = null;
      setLive(null);
    }
    if (!touches.current.size) multiTouch.current = false;
  }

  function cancel(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "pen") { penActive = false; penUsedAt = Date.now(); }
    touches.current.delete(event.pointerId);
    if (drawing.current === event.pointerId) { drawing.current = null; setLive(null); }
    // Keep the edge origin until touchend: native panning cancels pointer events.
  }

  return (
    <div ref={wrapRef} className={`ink-layer${active ? "" : " is-off"}`}>
      <canvas
        ref={canvasRef}
        aria-label="Ink on this page"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
      />
    </div>
  );
}
