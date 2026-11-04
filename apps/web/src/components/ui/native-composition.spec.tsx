// @vitest-environment jsdom
import { Button } from "@acme/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@acme/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@acme/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Input } from "@acme/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./form";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const button = () => {
  const node = host.querySelector("button");
  if (!node) throw new Error("Missing trigger");
  return node;
};

test("native render merges both refs, event handlers, and classes", async () => {
  const outer = createRef<HTMLButtonElement>();
  const inner = createRef<HTMLButtonElement>();
  const a = vi.fn();
  const b = vi.fn();
  await act(() =>
    root.render(
      <Button
        ref={outer}
        className="outer"
        onClick={a}
        render={
          <button type="button" ref={inner} className="inner" onClick={b}>
            Run
          </button>
        }
      />,
    ),
  );
  expect(outer.current).toBe(inner.current);
  expect(button().className).toContain("outer");
  expect(button().className).toContain("inner");
  await act(() => button().click());
  expect(a).toHaveBeenCalledOnce();
  expect(b).toHaveBeenCalledOnce();
});

test("a composed menu opens, activates its rendered link, and closes", async () => {
  const run = vi.fn();
  await act(() =>
    root.render(
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button>Actions</Button>} />
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={(event) => {
              event.preventDefault();
              run();
            }}
            render={<a href="/journal">Journal</a>}
          />
        </DropdownMenuContent>
      </DropdownMenu>,
    ),
  );
  await act(() => button().click());
  const item = document.querySelector<HTMLElement>('[role="menuitem"]');
  expect(item?.tagName).toBe("A");
  if (!item) throw new Error("Missing menu item");
  await act(() => item.click());
  expect(run).toHaveBeenCalledOnce();
  expect(button().getAttribute("aria-expanded")).toBe("false");
});

test("composed dialog and collapsible controls retain native triggers", async () => {
  await act(() =>
    root.render(
      <Dialog>
        <DialogTrigger render={<Button>Details</Button>} />
        <DialogContent>
          <DialogTitle>Details</DialogTitle>
        </DialogContent>
      </Dialog>,
    ),
  );
  await act(() => button().click());
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Details",
  );
  await act(() =>
    root.render(
      <Collapsible>
        <CollapsibleTrigger render={<Button>Expand</Button>} />
        <CollapsibleContent>Panel contents</CollapsibleContent>
      </Collapsible>,
    ),
  );
  await act(() => button().click());
  expect(button().getAttribute("aria-expanded")).toBe("true");
  expect(host.textContent).toContain("Panel contents");
});

test("Select uses item labels for controlled values and accepts null", async () => {
  const render = async (value: string | null) =>
    act(() =>
      root.render(
        <Select value={value} items={{ p: "Paragraph", q: "Quote" }}>
          <SelectTrigger>
            <SelectValue placeholder="Choose type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Paragraph</SelectItem>
            <SelectItem value="q">Quote</SelectItem>
          </SelectContent>
        </Select>,
      ),
    );
  await render("q");
  expect(button().textContent).toContain("Quote");
  await render(null);
  expect(button().textContent).toContain("Choose type");
});

test("uncontrolled Select updates its label after selection", async () => {
  const change = vi.fn();
  await act(() =>
    root.render(
      <Select
        defaultValue="p"
        items={{ p: "Paragraph", q: "Quote" }}
        onValueChange={change}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Paragraph</SelectItem>
          <SelectItem value="q">Quote</SelectItem>
        </SelectContent>
      </Select>,
    ),
  );
  await act(() => button().click());
  const quote = [
    ...document.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((node) => node.textContent?.includes("Quote"));
  if (!quote) throw new Error("Missing quote option");
  await act(() => quote.click());
  expect(button().textContent).toContain("Quote");
  expect(change.mock.calls[0]?.[0]).toBe("q");
});

test("FormControl composes field refs, labels, descriptions and validation state", async () => {
  function Fields() {
    const form = useForm({
      defaultValues: { name: "" },
      schema: z.object({ name: z.string() }),
    });
    return (
      <Form {...form}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl render={<Input {...field} />} />
              <FormDescription>Your name</FormDescription>
              <FormMessage />
              <Button
                onClick={() =>
                  form.setError(
                    "name",
                    { message: "Name is required", type: "manual" },
                    { shouldFocus: true },
                  )
                }
              >
                Validate
              </Button>
            </FormItem>
          )}
        />
      </Form>
    );
  }
  await act(() => root.render(<Fields />));
  const input = host.querySelector("input");
  if (!input) throw new Error("Missing input");
  expect(host.querySelector("label")?.htmlFor).toBe(input.id);
  const description = input.getAttribute("aria-describedby");
  expect(description && document.getElementById(description)?.textContent).toBe(
    "Your name",
  );
  await act(() => button().click());
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(input);
  expect(
    input
      .getAttribute("aria-describedby")
      ?.split(" ")
      .map((id) => document.getElementById(id)?.textContent),
  ).toContain("Name is required");
});

test("the retained Vaul drawer respects explicit controlled open state", async () => {
  const render = async (open: boolean) =>
    act(() =>
      root.render(
        <Drawer open={open}>
          <DrawerContent>
            <DrawerTitle>Chat</DrawerTitle>
            <DrawerDescription>Conversation</DrawerDescription>
          </DrawerContent>
        </Drawer>,
      ),
    );
  await render(false);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await render(true);
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Conversation",
  );
  await render(false);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
