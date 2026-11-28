import { flushSync } from "react-dom";

let activeReveal: { cancel: () => void } | undefined;

export function revealTheme(updateTheme: () => void, control: Element | null) {
  activeReveal?.cancel();

  if (
    !control ||
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    updateTheme();
    return;
  }

  const root = document.documentElement;
  const { left, top, width, height } = control.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  root.style.setProperty("--theme-reveal-origin", `${x}px ${y}px`);
  root.style.setProperty("--theme-reveal-radius", `${radius}px`);
  root.setAttribute("data-theme-reveal", "");

  const transition = document.startViewTransition(() => {
    if (activeReveal === reveal) flushSync(updateTheme);
  });
  const cleanup = () => {
    if (activeReveal !== reveal) return;
    activeReveal = undefined;
    root.removeAttribute("data-theme-reveal");
    root.style.removeProperty("--theme-reveal-origin");
    root.style.removeProperty("--theme-reveal-radius");
  };
  const reveal = {
    cancel: () => {
      cleanup();
      transition.skipTransition();
    },
  };
  activeReveal = reveal;
  void transition.ready.catch(() => {});
  void transition.finished.then(cleanup, cleanup);
}
