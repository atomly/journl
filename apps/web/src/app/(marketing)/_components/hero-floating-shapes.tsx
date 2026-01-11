"use client";

import { useEffect, useRef } from "react";

const shapes = [
  { duration: 4, size: 60, type: "circle", x: 4, y: 18 },
  { duration: 5, size: 40, type: "square", x: 96, y: 12 },
  { duration: 6, size: 50, type: "triangle", x: 6, y: 82 },
  { duration: 3, size: 30, type: "circle", x: 93, y: 78 },
  { duration: 4, size: 35, type: "triangle", x: 97, y: 52 },
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

      element.className = "absolute animate-pulse opacity-[0.035]";
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
        element.style.opacity = "0.035";
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
      className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
    />
  );
}
