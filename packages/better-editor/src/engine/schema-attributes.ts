import { editorColor as color } from "./colors";

export const textStyle = (props: Record<string, unknown> | null) =>
  `text-align:${props?.textAlignment ?? "left"};${props?.textColor && props.textColor !== "default" ? `color:${color(props.textColor)};` : ""}background-color:${color(props?.backgroundColor, true)}`;
export const parseAttrs = (element: HTMLElement) => {
  const value = element.getAttribute("data-better-editor-attrs");
  return value ? JSON.parse(value) : null;
};
export const htmlAttrs = (attrs: Record<string, unknown>) => ({
  "data-better-editor-attrs": JSON.stringify(attrs),
});

export const propsAttribute = () => ({
  props: { default: null, rendered: false },
});
