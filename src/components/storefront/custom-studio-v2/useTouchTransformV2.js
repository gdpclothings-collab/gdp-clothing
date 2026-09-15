import { useCallback, useRef } from 'react';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function pointDistance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAngle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

function pointCenter(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function normalizeAngle(value) {
  let angle = Number(value || 0);
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

export default function useTouchTransformV2({
  transform,
  onChange,
  containerRef,
  enabled = true,
  minScale = 30,
  maxScale = 220,
  minX = -48,
  maxX = 48,
  minY = -48,
  maxY = 48,
}) {
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const transformRef = useRef(transform || { scale: 100, rotation: 0, x: 0, y: 0 });
  transformRef.current = transform || transformRef.current;

  const containerRect = useCallback(() => {
    const node = containerRef?.current;
    return node?.getBoundingClientRect?.() || null;
  }, [containerRef]);

  const startGesture = useCallback(() => {
    const points = [...pointersRef.current.values()];
    const current = {
      scale: Number(transformRef.current?.scale || 100),
      rotation: Number(transformRef.current?.rotation || 0),
      x: Number(transformRef.current?.x || 0),
      y: Number(transformRef.current?.y || 0),
    };
    if (points.length >= 2) {
      const [first, second] = points;
      gestureRef.current = {
        mode: 'pinch',
        start: current,
        distance: Math.max(1, pointDistance(first, second)),
        angle: pointAngle(first, second),
        center: pointCenter(first, second),
      };
    } else if (points.length === 1) {
      gestureRef.current = { mode: 'drag', start: current, point: points[0] };
    } else {
      gestureRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((event) => {
    if (!enabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
  }, [enabled, startGesture]);

  const onPointerMove = useCallback((event) => {
    if (!enabled || !pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    const rect = containerRect();
    if (!gesture || !rect?.width || !rect?.height) return;
    const points = [...pointersRef.current.values()];

    if (gesture.mode === 'pinch' && points.length >= 2) {
      const [first, second] = points;
      const center = pointCenter(first, second);
      const distance = Math.max(1, pointDistance(first, second));
      const angle = pointAngle(first, second);
      onChange?.({
        ...transformRef.current,
        x: clamp(gesture.start.x + ((center.x - gesture.center.x) / rect.width) * 100, minX, maxX),
        y: clamp(gesture.start.y + ((center.y - gesture.center.y) / rect.height) * 100, minY, maxY),
        scale: clamp(gesture.start.scale * (distance / gesture.distance), minScale, maxScale),
        rotation: normalizeAngle(gesture.start.rotation + (angle - gesture.angle)),
      });
      return;
    }

    if (gesture.mode === 'drag' && points.length === 1) {
      const point = points[0];
      onChange?.({
        ...transformRef.current,
        x: clamp(gesture.start.x + ((point.x - gesture.point.x) / rect.width) * 100, minX, maxX),
        y: clamp(gesture.start.y + ((point.y - gesture.point.y) / rect.height) * 100, minY, maxY),
      });
    }
  }, [containerRect, enabled, maxScale, maxX, maxY, minScale, minX, minY, onChange]);

  const endPointer = useCallback((event) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch { /* pointer may already be released */ }
    pointersRef.current.delete(event.pointerId);
    startGesture();
  }, [startGesture]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    style: { touchAction: enabled ? 'none' : 'auto' },
  };
}
