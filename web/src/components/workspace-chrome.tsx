"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { MOTION, motionDuration } from "@/lib/motion";

// Preserve mounted panels until their exit transition has finished.
export function usePresence(visible: boolean) {
  const [presence, setPresence] = useState<{ rendered: boolean; motion: "initial" | "enter" | "exit" }>({ rendered: visible, motion: "initial" });
  useEffect(() => {
    let firstFrame = 0;
    let revealFrame = 0;
    let timeout = 0;
    if (visible) {
      setPresence((current) => current.rendered ? current : { rendered: true, motion: "initial" });
      firstFrame = window.requestAnimationFrame(() => {
        revealFrame = window.requestAnimationFrame(() => setPresence({ rendered: true, motion: "enter" }));
      });
    } else {
      setPresence((current) => current.rendered ? { ...current, motion: "exit" } : current);
      const duration = motionDuration(MOTION.surface + 80);
      timeout = window.setTimeout(() => setPresence({ rendered: false, motion: "initial" }), duration);
    }
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(timeout);
    };
  }, [visible]);
  return presence;
}

export function useBrandIntro() {
  const [phase, setPhase] = useState<"initial" | "showing" | "logo-leaving" | "screen-leaving" | "done">("initial");
  const [logoLoaded, setLogoLoaded] = useState(false);

  useEffect(() => {
    // An unavailable logo must never block access to the working map.
    const timeout = window.setTimeout(() => setPhase("done"), 6500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("done");
      return;
    }
    if (!logoLoaded) return;
    let firstFrame = 0;
    let revealFrame = 0;
    const timers: number[] = [];
    firstFrame = window.requestAnimationFrame(() => {
      revealFrame = window.requestAnimationFrame(() => {
        setPhase("showing");
        timers.push(window.setTimeout(() => setPhase("logo-leaving"), 2300));
        timers.push(window.setTimeout(() => setPhase("screen-leaving"), 3500));
        timers.push(window.setTimeout(() => setPhase("done"), 4600));
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(revealFrame);
      timers.forEach(window.clearTimeout);
    };
  }, [logoLoaded]);

  return { phase, ready: phase === "done", revealing: phase === "screen-leaving" || phase === "done", loaded: () => setLogoLoaded(true), failed: () => setPhase("done") };
}

export function BrandIntro({ intro }: { intro: ReturnType<typeof useBrandIntro> }) {
  if (intro.ready) return null;
  return (
    <div className="intro-screen" data-phase={intro.phase} role="status" aria-label="Loading TRASHOPOLY">
      <Image className="intro-logo" src="/brand/trashopoly-logo.png" alt="TRASHOPOLY — Smart Vineyard Routing" width={2021} height={778} loading="eager" fetchPriority="high" unoptimized onLoad={intro.loaded} onError={intro.failed} />
    </div>
  );
}

export function PanelCollapse({ label, collapsed, controls, onClick }: { label: string; collapsed: boolean; controls: string; onClick: () => void }) {
  return (
    <button type="button" className="panel-collapse" aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`} aria-controls={controls} aria-expanded={!collapsed} onClick={onClick}>
      <svg className="panel-toggle-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M3 8H13" /><path className="panel-toggle-vertical" d="M8 3V13" />
      </svg>
    </button>
  );
}

export function PanelHeader({ icon, title, headingId, label, collapsed, controls, onToggle }: { icon: ReactNode; title: string; headingId: string; label: string; collapsed: boolean; controls: string; onToggle: () => void }) {
  return <div className="panel-title">{icon}<h2 id={headingId}>{title}</h2><PanelCollapse label={label} collapsed={collapsed} controls={controls} onClick={onToggle} /></div>;
}

export function PanelBody({ id, collapsed, className = "", children }: { id: string; collapsed: boolean; className?: string; children: ReactNode }) {
  return <div className="panel-content" id={id} aria-hidden={collapsed} inert={collapsed}><div className="panel-content-inner"><div className={className}>{children}</div></div></div>;
}
