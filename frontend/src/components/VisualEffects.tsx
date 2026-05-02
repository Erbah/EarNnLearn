'use client';

import { useEffect, useState } from 'react';
import type { EffectState } from '@/lib/effects';
import { effectsManager } from '@/lib/effects';
// import { WhiteboardView } from './WhiteboardView';

export function SpotlightOverlay() {
  const [effects, setEffects] = useState<EffectState>(effectsManager.getState());

  useEffect(() => {
    const unsubscribe = effectsManager.subscribe(setEffects);
    return unsubscribe;
  }, []);

  if (!effects.spotlight.active) return null;

  const { x = 0, y = 0, radius = 150, opacity = 0.7 } = effects.spotlight;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        background: `radial-gradient(circle ${radius}px at ${x}px ${y}px, transparent 0%, rgba(0, 0, 0, ${opacity}) 100%)`,
        zIndex: 40,
        transition: 'all 0.2s ease-out',
      }}
    />
  );
}

export function LaserPointer() {
  const [effects, setEffects] = useState<EffectState>(effectsManager.getState());

  useEffect(() => {
    const unsubscribe = effectsManager.subscribe(setEffects);
    return unsubscribe;
  }, []);

  if (!effects.laser.active) return null;

  const { x = 0, y = 0, angle = 0, color = '#ff0000', length = 300 } = effects.laser;

  // Calculate end point of laser
  const endX = x + Math.cos((angle * Math.PI) / 180) * length;
  const endY = y + Math.sin((angle * Math.PI) / 180) * length;

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 40 }}
      width="100%"
      height="100%"
    >
      {/* Laser beam with glow */}
      <defs>
        <filter id="laser-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Main laser line */}
      <line
        x1={x}
        y1={y}
        x2={endX}
        y2={endY}
        stroke={color}
        strokeWidth="4"
        filter="url(#laser-glow)"
        opacity="0.8"
        style={{
          animation: 'pulse 0.5s infinite',
        }}
      />

      {/* Laser dot at start */}
      <circle cx={x} cy={y} r="6" fill={color} opacity="0.9" filter="url(#laser-glow)" />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>
    </svg>
  );
}

export function HighlightBox({ elementId }: { elementId: string }) {
  const [effects, setEffects] = useState<EffectState>(effectsManager.getState());

  useEffect(() => {
    const unsubscribe = effectsManager.subscribe(setEffects);
    return unsubscribe;
  }, []);

  if (!effects.highlighting.has(elementId)) return null;

  const element = document.getElementById(elementId);
  if (!element) return null;

  const rect = element.getBoundingClientRect();

  return (
    <div
      className="fixed border-2 border-yellow-400 rounded-lg pointer-events-none"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: 30,
        boxShadow: '0 0 20px rgba(250, 204, 21, 0.6)',
        animation: 'highlight-pulse 1s infinite',
      }}
    >
      <style>{`
        @keyframes highlight-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(250, 204, 21, 0.6); }
          50% { box-shadow: 0 0 40px rgba(250, 204, 21, 1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Combined VisualEffects component that renders all active effects
 */
export function VisualEffects({ state }: { state?: EffectState }) {
  const [effects, setEffects] = useState<EffectState>(state || effectsManager.getState());

  useEffect(() => {
    if (state) {
      setEffects(state);
    }
  }, [state]);

  return (
    <>
      {/* Whiteboard Layer - Deprecated */}
      {/* <WhiteboardView /> */}

      {/* Render all active effects (Deprecated) */}
      {/* 
      {effects?.spotlight.active && (
        <SpotlightOverlay />
      )}
      {effects?.laser.active && (
        <LaserPointer />
      )}
      {effects?.highlighting.size > 0 && (
        <div>
          {Array.from(effects.highlighting).map(elementId => (
            <HighlightBox key={elementId} elementId={elementId} />
          ))}
        </div>
      )}
      */}
    </>
  );
}
