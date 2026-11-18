import type { ImgHTMLAttributes } from "react";

// Brand only uses unoptimized static SVGs. Preserve native image semantics in Vite.
export default function Image({
  unoptimized: _unoptimized,
  alt,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  return <img alt={alt} {...props} />;
}
