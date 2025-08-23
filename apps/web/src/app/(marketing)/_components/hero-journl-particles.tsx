"use client";

import { type CanvasHTMLAttributes, useEffect, useRef, useState } from "react";
import { cn } from "~/components/utils";

const HOVER_COLOR = "#FFFFFF";
const FILL_COLOR = "#FFFFFF";
const PARTICLES_TEXT = "Journl";

type JournlParticlesProps = {
  className?: string;
  canvasProps?: CanvasHTMLAttributes<HTMLCanvasElement>;
};

export function HeroJournlParticles({
  className: wrapperClassName,
  canvasProps: { className: canvasClassName, ...canvasRest } = {},
  ...wrapperRest
}: JournlParticlesProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isTouchingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const updateCanvasSize = () => {
      if (wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Set actual size in memory (scaled by device pixel ratio)
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;

        // Scale back down using CSS
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        // Scale the drawing context so everything draws at the correct size
        ctx.scale(dpr, dpr);
      }
      setIsMobile(window.innerWidth < 768);
    };

    updateCanvasSize();

    let particles: {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      color: string;
      scatteredColor: string;
      life: number;
    }[] = [];

    let textImageData: ImageData | null = null;

    function createTextImage() {
      if (!ctx || !canvas) return 0;

      if (canvas.width === 0 || canvas.height === 0) {
        return 1;
      }

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;

      ctx.fillStyle = FILL_COLOR;
      ctx.save();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const fontSize = isMobile ? 90 : 120;
      ctx.font = `bold ${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(PARTICLES_TEXT, displayWidth / 2, displayHeight / 2);

      textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      return 1;
    }

    function createParticle(scale: number) {
      if (!ctx || !canvas || !textImageData) return null;

      const data = textImageData.data;
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;

      for (let attempt = 0; attempt < 100; attempt++) {
        const displayX = Math.floor(Math.random() * displayWidth);
        const displayY = Math.floor(Math.random() * displayHeight);

        // Convert to canvas coordinates for pixel sampling
        const canvasX = Math.floor(displayX * dpr);
        const canvasY = Math.floor(displayY * dpr);

        const particle = data[(canvasY * canvas.width + canvasX) * 4 + 3];

        if (particle && particle > 128) {
          return {
            baseX: displayX,
            baseY: displayY,
            color: FILL_COLOR,
            life: Math.random() * 100 + 50,
            scatteredColor: HOVER_COLOR,
            size: scale * (Math.random() * 2 + 1),
            x: displayX,
            y: displayY,
          };
        }
      }

      return null;
    }

    function createInitialParticles(scale: number) {
      if (!canvas) return;
      // Reduce particle count for mobile devices (especially iOS)
      const baseParticleCount = isMobile ? 6000 : 8000;
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;

      const particleCount = Math.floor(
        baseParticleCount *
          Math.sqrt((displayWidth * displayHeight) / (1920 * 1080)),
      );
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle(scale);
        if (particle) particles.push(particle);
      }
    }

    let animationFrameId: number;

    function animate(scale: number) {
      if (!ctx || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      const maxDistance = 200;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p) continue;

        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (
          distance < maxDistance &&
          (isTouchingRef.current || !("ontouchstart" in window))
        ) {
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          const moveX = Math.cos(angle) * force * 50;
          const moveY = Math.sin(angle) * force * 50;
          p.x = p.baseX - moveX;
          p.y = p.baseY - moveY;

          ctx.fillStyle = p.scatteredColor;
        } else {
          p.x += (p.baseX - p.x) * 0.08;
          p.y += (p.baseY - p.y) * 0.08;
          ctx.fillStyle = FILL_COLOR;
        }

        ctx.fillRect(p.x, p.y, p.size, p.size);

        p.life--;
        if (p.life <= 0) {
          const newParticle = createParticle(scale);
          if (newParticle) {
            particles[i] = newParticle;
          } else {
            particles.splice(i, 1);
            i--;
          }
        }
      }

      const baseParticleCount = isMobile ? 3000 : 8000;
      const targetParticleCount = Math.floor(
        baseParticleCount *
          Math.sqrt((displayWidth * displayHeight) / (1920 * 1080)),
      );
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle(scale);
        if (newParticle) particles.push(newParticle);
      }

      animationFrameId = requestAnimationFrame(() => animate(scale));
    }

    const scale = createTextImage();
    createInitialParticles(scale);
    animate(scale);

    const handleResize = () => {
      updateCanvasSize();
      const newScale = createTextImage();
      particles = [];
      createInitialParticles(newScale);
    };

    const handleMove = (x: number, y: number) => {
      mousePositionRef.current = { x, y };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      handleMove(e.clientX - rect.left, e.clientY - rect.top);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0 && e.touches[0]) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        handleMove(
          e.touches[0].clientX - rect.left,
          e.touches[0].clientY - rect.top,
        );
      }
    };

    const handleTouchStart = () => {
      isTouchingRef.current = true;
    };

    const handleTouchEnd = () => {
      isTouchingRef.current = false;
      mousePositionRef.current = { x: 0, y: 0 };
    };

    const handleMouseLeave = () => {
      if (!("ontouchstart" in window)) {
        mousePositionRef.current = { x: 0, y: 0 };
      }
    };

    window.addEventListener("resize", handleResize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile]);

  return (
    <div
      className={cn(
        "relative h-32 w-full animate-in md:h-30",
        wrapperClassName,
      )}
      ref={wrapperRef}
      {...wrapperRest}
    >
      <canvas
        aria-label="Interactive Journl logo made of particles"
        className={cn(
          "pointer-events-auto absolute inset-0 h-full w-full",
          canvasClassName,
        )}
        ref={canvasRef}
        {...canvasRest}
      />
    </div>
  );
}
