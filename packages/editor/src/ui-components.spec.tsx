// @vitest-environment jsdom
import { Button as BaseButton } from "@base-ui/react/button";
import { act, type ComponentProps, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { EditorHint } from "./controls";
import { editorUI } from "./ui";
import {
  Button,
  EditorUIProvider,
  Input,
  SurfaceButton,
} from "./ui-components";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
afterEach(async () => {
  await act(async () => root.render(null));
});

test("an alternative adapter receives refs, events and accessible names without remounting controls", async () => {
  const clicks = vi.fn();
  const ref = createRef<HTMLButtonElement>();
  function AlternativeButton({
    size: _size,
    variant: _variant,
    asChild: _asChild,
    ...props
  }: ComponentProps<typeof Button>) {
    return <BaseButton {...props} data-alternative-ui="" />;
  }
  const components = { ...editorUI, Button: AlternativeButton };
  const render = (label: string) => (
    <EditorUIProvider components={components}>
      <Button ref={ref} aria-label={label} onClick={clicks}>
        Action
      </Button>
    </EditorUIProvider>
  );
  await act(async () => root.render(render("First action")));
  const element = ref.current;
  expect(element?.hasAttribute("data-alternative-ui")).toBe(true);
  await act(async () => element?.click());
  expect(clicks).toHaveBeenCalledOnce();
  await act(async () => root.render(render("Updated action")));
  expect(ref.current).toBe(element);
  expect(element?.getAttribute("aria-label")).toBe("Updated action");
});

test("nested providers override their own controls and composed tooltip triggers reach the actual button", async () => {
  const ref = createRef<HTMLButtonElement>();
  const NestedButton = (props: ComponentProps<typeof Button>) => (
    <editorUI.Button {...props} data-nested-ui="" />
  );
  await act(async () =>
    root.render(
      <EditorUIProvider components={editorUI}>
        <Button>Outer</Button>
        <EditorUIProvider components={{ ...editorUI, Button: NestedButton }}>
          <EditorHint label="Inner action">
            <Button ref={ref}>Inner</Button>
          </EditorHint>
        </EditorUIProvider>
      </EditorUIProvider>,
    ),
  );
  expect(host.querySelectorAll("button")).toHaveLength(2);
  expect(host.querySelector("button")?.hasAttribute("data-nested-ui")).toBe(
    false,
  );
  expect(ref.current?.hasAttribute("data-nested-ui")).toBe(true);
  expect(ref.current?.getAttribute("data-slot")).toBe("tooltip-trigger");
});

test("custom-styled surfaces and link fields use replaceable slots without losing native semantics", async () => {
  const buttonRef = createRef<HTMLButtonElement>();
  const inputRef = createRef<HTMLInputElement>();
  const components = {
    ...editorUI,
    Input: (props: ComponentProps<typeof Input>) => (
      <input {...props} data-input-adapter="" />
    ),
    SurfaceButton: (props: ComponentProps<typeof SurfaceButton>) => (
      <BaseButton {...props} data-surface-adapter="" />
    ),
  };
  await act(async () =>
    root.render(
      <EditorUIProvider components={components}>
        <EditorHint label="Insert paragraph">
          <SurfaceButton
            ref={buttonRef}
            role="option"
            aria-selected
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
          >
            Paragraph
          </SurfaceButton>
        </EditorHint>
        <Input
          ref={inputRef}
          aria-label="Reference URL"
          type="url"
          required
          defaultValue="https://example.com"
        />
      </EditorUIProvider>,
    ),
  );
  const down = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  await act(async () => buttonRef.current?.dispatchEvent(down));
  expect(down.defaultPrevented).toBe(true);
  expect(buttonRef.current?.getAttribute("role")).toBe("option");
  expect(buttonRef.current?.getAttribute("aria-selected")).toBe("true");
  expect(buttonRef.current?.hasAttribute("data-surface-adapter")).toBe(true);
  expect(inputRef.current?.value).toBe("https://example.com");
  expect(inputRef.current?.required).toBe(true);
  expect(inputRef.current?.hasAttribute("data-input-adapter")).toBe(true);
});
