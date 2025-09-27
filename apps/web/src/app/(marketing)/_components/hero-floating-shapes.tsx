"use client";

import { useEffect, useRef } from "react";

const shapes = [
  { duration: 4, size: 60, type: "circle", x: 10, y: 20 },
  { duration: 5, size: 40, type: "square", x: 85, y: 15 },
  { duration: 6, size: 50, type: "triangle", x: 15, y: 70 },
  { duration: 3, size: 30, type: "circle", x: 80, y: 75 },
  { duration: 4, size: 35, type: "triangle", x: 90, y: 50 },
];

const types = ["circle", "square", "triangle"] as const;

export function HeroFloatingShapes() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    shapes.forEach((shape, index) => {
      const randomType = types[Math.floor(Math.random() * types.length)];
      const element = document.createElement("div");

      element.className = "absolute opacity-5 animate-pulse";
      element.style.left = `${shape.x}%`;
      element.style.top = `${shape.y}%`;
      element.style.width = `${shape.size}px`;
      element.style.height = `${shape.size}px`;
      element.style.animationDuration = `${shape.duration}s`;
      element.style.animationDelay = `${index * 2}s`;

      if (randomType === "circle") {
        element.style.borderRadius = "50%";
        element.style.border = "2px solid white"; // Changed from black
      } else if (randomType === "square") {
        element.style.border = "2px solid white"; // Changed from black
        element.style.transform = "rotate(45deg)";
      } else if (randomType === "triangle") {
        element.style.width = "0";
        element.style.height = "0";
        element.style.borderLeft = `${shape.size / 2}px solid transparent`;
        element.style.borderRight = `${shape.size / 2}px solid transparent`;
        element.style.borderBottom = `${shape.size}px solid white`; // Changed from black
        element.style.opacity = "0.05";
      }

      container.appendChild(element);
    });

    return () => {
      if (container) {
        container.innerHTML = "";
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
}
