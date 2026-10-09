/** Authenticated browser acceptance against a LOCAL Next.js server; disposable DB owners. */

import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inArray } from "@acme/db";
import { db } from "@acme/db/client";
import {
  BlockNode,
  BlockSearchText,
  Document,
  DocumentReference,
  Page,
  session,
  user,
} from "@acme/db/schema";
import { markExploreDirty } from "../src/explore/refresh";
import { refreshExploreSnapshot } from "../src/explore/snapshots";

const base = "http://localhost:3001";
const localSecret = "local-build-secret-that-is-long-enough";
const owners = [randomUUID(), randomUUID()];
const notes = Array.from({ length: 28 }, () => randomUUID());
const blocks = notes.map(() => randomUUID());
const profile = await mkdtemp(join(tmpdir(), "journl-explore-browser-"));
let chrome: ReturnType<typeof spawn> | undefined;
let socket: WebSocket | undefined;
let failures = 0;
const check = (value: unknown, label: string) => {
  if (!value) {
    failures++;
    throw new Error(label);
  }
};
try {
  const tokens = owners.map(() => randomUUID());
  await db.transaction(async (tx) => {
    await tx.insert(user).values(
      owners.map((id, i) => ({
        email: `explore-browser-${id}@example.invalid`,
        id,
        name: `Browser fixture ${i}`,
      })),
    );
    await tx.insert(session).values(
      owners.map((userId, i) => ({
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        id: randomUUID(),
        token: tokens[i]!,
        updatedAt: new Date(),
        userId,
      })),
    );
    await tx
      .insert(Document)
      .values(notes.map((id) => ({ id, user_id: owners[0]! })));
    await tx.insert(Page).values(
      notes.map((document_id, i) => ({
        document_id,
        title: `${i < 22 ? "Editor decisions and reflections on recurring implementation details" : "Release"} note ${String(i).padStart(2, "0")}`,
        user_id: owners[0]!,
      })),
    );
    await tx.insert(BlockNode).values(
      blocks.map((id, i) => ({
        data: {
          content: [{ text: `Supporting passage ${i}`, type: "text" }],
          props: {},
          type: "paragraph",
        },
        document_id: notes[i]!,
        id,
        user_id: owners[0]!,
      })),
    );
    await tx.insert(BlockSearchText).values(
      blocks.map((block_id, i) => ({
        block_id,
        document_id: notes[i]!,
        search_text: `Supporting passage ${i}`,
        user_id: owners[0]!,
      })),
    );
    const refs: (typeof DocumentReference.$inferInsert)[] = [];
    for (const [start, end] of [
      [0, 22],
      [22, 28],
    ])
      for (let i = start!; i < end!; i++)
        for (let j = i + 1; j < end!; j++)
          refs.push({
            occurrence_path: `/${j}`,
            presentation: "link",
            source_block_id: blocks[i]!,
            source_document_id: notes[i]!,
            target_document_id: notes[j]!,
            target_key: `document:${notes[j]}`,
            target_kind: "document",
            user_id: owners[0]!,
          });
    refs.push({
      occurrence_path: "/bridge",
      presentation: "link",
      source_block_id: blocks[0]!,
      source_document_id: notes[0]!,
      target_document_id: notes[22]!,
      target_key: `document:${notes[22]}`,
      target_kind: "document",
      user_id: owners[0]!,
    });
    refs.push({
      occurrence_path: "/source",
      presentation: "link",
      source_block_id: blocks[0]!,
      source_document_id: notes[0]!,
      target_key: "external:browser-source",
      target_kind: "external",
      target_url: "https://example.com/explore-test",
      user_id: owners[0]!,
    });
    await tx.insert(DocumentReference).values(refs);
    for (const owner of owners) await markExploreDirty(tx, owner);
  });
  for (const owner of owners) await refreshExploreSnapshot(owner);
  chrome = spawn(
    "/opt/chromium/chrome",
    [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--remote-debugging-port=9241",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let target: { webSocketDebuggerUrl: string } | undefined;
  for (let i = 0; i < 30; i++) {
    try {
      target = await fetch("http://127.0.0.1:9241/json/new?about:blank", {
        method: "PUT",
      }).then((r) => r.json());
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  check(target, "Chrome did not start");
  socket = new WebSocket(target!.webSocketDebuggerUrl);
  await new Promise((r) => socket!.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map<number, (result: Record<string, unknown>) => void>();
  const runtimeErrors: unknown[] = [];
  const responses: unknown[] = [];
  const loadingFailures: unknown[] = [];
  const outstanding = new Map<string, string>();

  socket.addEventListener("message", (event) => {
    const m = JSON.parse(String(event.data));
    if (m.id) {
      pending.get(m.id)?.(m.result ?? { protocolError: m.error });
      pending.delete(m.id);
    }
    if (m.method === "Runtime.exceptionThrown") runtimeErrors.push(m.params);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      runtimeErrors.push(
        m.params.args.map(
          (a: { description?: string; value?: unknown }) =>
            a.description ?? a.value,
        ),
      );
    if (m.method === "Network.responseReceived")
      responses.push({
        status: m.params.response.status,
        url: m.params.response.url.split("?")[0],
      });
    if (m.method === "Network.requestWillBeSent")
      outstanding.set(m.params.requestId, m.params.request.url.split("?")[0]);
    if (m.method === "Network.loadingFinished")
      outstanding.delete(m.params.requestId);
    if (m.method === "Network.loadingFailed") {
      loadingFailures.push({
        blocked: m.params.blockedReason,
        error: m.params.errorText,
        url: outstanding.get(m.params.requestId),
      });
      outstanding.delete(m.params.requestId);
    }
  });
  const call = (method: string, params: object = {}) =>
    new Promise<Record<string, unknown>>((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      socket!.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression: string) => {
    const result = await call("Runtime.evaluate", {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });
    if (result.protocolError)
      throw new Error((result.protocolError as { message: string }).message);
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails as {
        exception?: { description?: string };
      };
      throw new Error(
        `Browser evaluation failed: ${detail.exception?.description ?? "unknown exception"}`,
      );
    }
    return (result.result as { value: unknown })?.value;
  };
  const wait = async (expression: string) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (await evaluate(`Boolean(${expression})`)) return;
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !/Execution context was destroyed|Cannot find context|Inspected target navigated/i.test(
            error.message,
          )
        )
          throw error;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(
      `Browser wait failed: ${expression}; responses=${JSON.stringify(responses)}; outstanding=${JSON.stringify([...outstanding.values()])}; failed=${JSON.stringify(loadingFailures)}; errors=${JSON.stringify(runtimeErrors)}; ${JSON.stringify(await evaluate('({ready:document.readyState,visibility:document.visibilityState,scripts:[...document.scripts].filter(s=>s.src).map(s=>({src:s.src,type:s.type,async:s.async})),nextFlight:globalThis.__next_f?.length,path:location.pathname,head:document.querySelector("main")?.innerText.slice(0,500),active:document.activeElement?.outerHTML.slice(0,250),islands:document.querySelectorAll("svg foreignObject").length})'))}`,
    );
  };
  const navigate = async (path: string) => {
    await call("Page.navigate", { url: base + path });
    await wait('document.querySelector("main h1")');
  };
  const screenshot = async (path: string) => {
    const result = await call("Page.captureScreenshot", { format: "png" });
    await writeFile(path, Buffer.from(result.data as string, "base64"));
  };
  const viewportPoint = async () =>
    evaluate(
      '(()=>{const r=document.querySelector("main svg[aria-label]").getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(Math.max(120,r.top)+80)}})()',
    ) as Promise<{ x: number; y: number }>;
  const canvasTransform = () =>
    evaluate(
      'document.querySelector("main svg[aria-label] > g")?.getAttribute("transform")',
    );
  const canvasZoom = async () =>
    Number(
      String(await canvasTransform())
        .split("scale(")[1]
        ?.split(")")[0],
    );
  const cookie = async (index: number) => {
    await call("Network.clearBrowserCookies");
    const token = tokens[index]!;
    const signature = createHmac("sha256", localSecret)
      .update(token)
      .digest("base64");
    await call("Network.setCookie", {
      httpOnly: true,
      name: "better-auth.session_token",
      url: base,
      value: encodeURIComponent(`${token}.${signature}`),
    });
  };
  await call("Page.enable");
  await call("Page.bringToFront");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: 1000,
    mobile: false,
    width: 1440,
  });
  await cookie(0);
  await navigate("/explore");
  await wait('document.querySelectorAll("svg foreignObject").length===2');
  check(
    !(await evaluate("document.body.scrollWidth>innerWidth")),
    "Desktop horizontal overflow",
  );
  const islandActionsFit = () =>
    evaluate(
      '([...document.querySelectorAll("main svg foreignObject")].every(fo=>[...fo.querySelectorAll("a")].every(a=>a.getBoundingClientRect().bottom<=fo.getBoundingClientRect().bottom+1)))',
    );
  check(await islandActionsFit(), "Desktop thread actions clip outside island");
  await screenshot("/tmp/journl-explore-v3-overview-desktop.png");
  const zoomBefore = await canvasZoom();
  const wheelPoint = await viewportPoint();
  await call("Input.dispatchMouseEvent", {
    type: "mouseWheel",
    ...wheelPoint,
    deltaX: 0,
    deltaY: -30,
    modifiers: 2,
  });
  await wait(
    `Number(document.querySelector("main svg[aria-label] > g")?.getAttribute("transform").split("scale(")[1]?.split(")")[0])>${zoomBefore}`,
  );
  await evaluate(
    `document.querySelector('[aria-label="Fit threads"]').click()`,
  );
  const selectExpression =
    '[...document.querySelectorAll("svg foreignObject")].find(el=>el.textContent.includes("22 notes")).querySelector("button")';
  await evaluate(`${selectExpression}.focus();`);
  await call("Input.dispatchKeyEvent", {
    code: "Enter",
    key: "Enter",
    nativeVirtualKeyCode: 13,
    text: "\r",
    type: "keyDown",
    unmodifiedText: "\r",
    windowsVirtualKeyCode: 13,
  });
  await call("Input.dispatchKeyEvent", {
    code: "Enter",
    key: "Enter",
    type: "keyUp",
    windowsVirtualKeyCode: 13,
  });
  await wait(
    'document.querySelector("[aria-label=\\"Thread connections\\"]")?.textContent.includes("1 references")',
  );
  await evaluate(
    `${selectExpression}.closest("foreignObject").querySelector("a").click()`,
  );
  await wait(
    'location.pathname.includes("/clusters/") && document.querySelector("[aria-label=\\"Representative notes\\"]")',
  );
  const clusterPath = (await evaluate("location.pathname")) as string;
  // Exercise full pagination when the first island is the 22-note thread.
  await wait(
    'document.querySelectorAll("[aria-label=\\"All notes and sources\\"] article").length===20',
  );
  const nextEnabled = await evaluate(
    '[...document.querySelectorAll("[aria-label=\\"All notes and sources\\"] button")].some(b=>b.textContent==="Next"&&!b.disabled)',
  );
  check(nextEnabled, "Full note pagination was not available");
  if (nextEnabled) {
    await evaluate(
      '[...document.querySelectorAll("[aria-label=\\"All notes and sources\\"] button")].find(b=>b.textContent==="Next").click()',
    );
    await wait(
      'document.querySelectorAll("[aria-label=\\"All notes and sources\\"] article").length===2',
    );
  }
  await evaluate(
    'document.querySelector("[aria-label=\\"Representative notes\\"] a").click()',
  );
  await wait(
    'location.pathname.includes("/notes/") && document.querySelector("svg button")',
  );
  const firstNotePath = (await evaluate("location.pathname")) as string;
  await evaluate(
    '[...document.querySelectorAll("svg button")].find(b=>!b.textContent.includes("Starting note")&&!b.textContent.includes("Linked source")).click()',
  );
  await wait('document.querySelector("[aria-label=\\"Note preview\\"]")');
  await evaluate(
    '[...document.querySelectorAll("[aria-label=\\"Note preview\\"] button")].find(b=>b.textContent==="Explore connections").click()',
  );
  await wait(
    `location.pathname!==${JSON.stringify(firstNotePath)} && location.pathname.includes("/notes/")`,
  );
  check(
    await evaluate('location.search.includes("thread=")'),
    "Origin thread lost",
  );
  await wait(
    'document.querySelector("[aria-label=\\"Back to previous exploration\\"]")',
  );
  await evaluate(
    'document.querySelector("[aria-label=\\"Back to previous exploration\\"]").click()',
  );
  await wait(`location.pathname===${JSON.stringify(firstNotePath)}`);
  await navigate(clusterPath);
  await wait(
    `document.querySelectorAll('[aria-label="All notes and sources"] article').length>0`,
  );
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent==="Sources").click()',
  );
  await wait(
    '[...document.querySelectorAll("a")].some(a=>a.textContent.includes("Read context"))',
  );
  await evaluate(
    '[...document.querySelectorAll("a")].find(a=>a.textContent.includes("Read context")).click()',
  );
  await wait(
    'location.pathname.endsWith("/sources") && document.querySelector("main")?.textContent.includes("Supporting passage 0")',
  );
  await evaluate(
    '[...document.querySelectorAll("main a")].find(a=>a.textContent.includes("Open passage")).click()',
  );
  await wait(
    `location.pathname.startsWith("/pages/") && location.hash==="#block=${blocks[0]}" && document.querySelector('[data-id="${blocks[0]}"]')`,
  );
  await navigate(clusterPath);
  await wait(`document.querySelector('[aria-label="Rename thread"]')`);
  await evaluate(
    `document.querySelector('[aria-label="Rename thread"]').click()`,
  );
  await wait('document.querySelector("[role=dialog] input")');
  await evaluate(
    '(()=>{const input=document.querySelector("[role=dialog] input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Renamed browser thread about recurring implementation decisions");input.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
  await evaluate(
    '[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent==="Save name").click()',
  );
  await wait(
    'document.querySelector("main h1")?.textContent==="Renamed browser thread about recurring implementation decisions"',
  );
  await call("Emulation.setDeviceMetricsOverride", {
    deviceScaleFactor: 1,
    height: 852,
    mobile: true,
    width: 393,
  });
  await call("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 2,
  });
  await navigate("/explore");
  await wait('document.querySelectorAll("svg foreignObject").length===2');
  check(await islandActionsFit(), "Mobile two-line title clips thread action");
  check(
    await evaluate(
      '(()=>{const b=[...document.querySelectorAll("main svg foreignObject button")].find(b=>b.textContent.includes("Renamed browser"));const range=document.createRange();range.selectNodeContents(b);return range.getBoundingClientRect().height>25})()',
    ),
    "Mobile fixture title did not wrap onto two lines",
  );
  await screenshot("/tmp/journl-explore-v3-overview-mobile.png");
  await navigate(clusterPath);
  await wait('document.querySelector("svg button")');
  const pinchBefore = await canvasZoom();
  const pinchPoint = await viewportPoint();
  await call("Input.dispatchTouchEvent", {
    touchPoints: [
      { id: 0, x: pinchPoint.x - 25, y: pinchPoint.y },
      { id: 1, x: pinchPoint.x + 25, y: pinchPoint.y },
    ],
    type: "touchStart",
  });
  await call("Input.dispatchTouchEvent", {
    touchPoints: [
      { id: 0, x: pinchPoint.x - 50, y: pinchPoint.y },
      { id: 1, x: pinchPoint.x + 50, y: pinchPoint.y },
    ],
    type: "touchMove",
  });
  await call("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
  await wait(
    `Number(document.querySelector("main svg[aria-label] > g")?.getAttribute("transform").split("scale(")[1]?.split(")")[0])>${pinchBefore}`,
  );
  await evaluate('document.querySelector("svg button").click()');
  await wait('document.querySelector("[data-slot=sheet-content]")');
  const bounds = (await evaluate(
    '(()=>{const r=document.querySelector("[data-slot=sheet-content]").getBoundingClientRect();return {height:r.height,width:r.width,overflow:document.body.scrollWidth>innerWidth}})()',
  )) as { height: number; width: number; overflow: boolean };
  check(
    bounds.height <= 852 * 0.8 && !bounds.overflow,
    "Mobile preview exceeds bounds",
  );
  await new Promise((r) => setTimeout(r, 700));
  const settledBounds = await evaluate(
    'document.querySelector("[data-slot=sheet-content]").getBoundingClientRect().height',
  );
  check(
    Math.abs(Number(settledBounds) - bounds.height) < 2,
    "Mobile preview height shifted after loading",
  );
  await screenshot("/tmp/journl-explore-v3-thread-mobile.png");
  check(
    await evaluate(
      'document.querySelector("[data-slot=sheet-content]").querySelectorAll("[data-slot=sheet-close], button[aria-label=\\"Close preview\\"]").length === 1',
    ),
    "Mobile preview must have exactly one close button",
  );
  await evaluate(
    'document.querySelector("[data-slot=sheet-content] button[aria-label=\\"Close preview\\"]").click()',
  );
  await wait('!document.querySelector("[data-slot=sheet-content]")');
  await navigate("/explore");
  await wait('document.querySelector("input[aria-label=\\"Find a thread\\"]")');
  await evaluate(
    '(()=>{const input=document.querySelector("input[aria-label=\\"Find a thread\\"]");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Renamed");input.dispatchEvent(new Event("input",{bubbles:true}));})()',
  );
  await new Promise((r) => setTimeout(r, 700));
  await cookie(1);
  await navigate("/explore");
  await wait(
    'document.querySelector("main")?.textContent.includes("Your next thread")',
  );
  check(
    await evaluate(
      'document.querySelector("input[aria-label=\\"Find a thread\\"]").value===""',
    ),
    "Search crossed accounts",
  );
  check(runtimeErrors.length === 0, "Browser runtime exceptions");
  console.log(
    JSON.stringify({
      authenticated: true,
      checks: [
        "overview keyboard selection",
        "authored bridges",
        "cluster representatives",
        "full note pagination",
        "source context and authored passage navigation",
        "trackpad zoom",
        "two-finger pinch",
        "note route remount/back",
        "thread origin",
        "rename",
        "mobile bounds",
        "single mobile preview close button",
        "account isolation",
      ],
      failures,
      status: "passed",
    }),
  );
} finally {
  socket?.close();
  if (chrome && chrome.exitCode === null) {
    const stopped = new Promise<void>((resolve) => {
      chrome!.once("exit", () => resolve());
      setTimeout(resolve, 3000);
    });
    chrome.kill("SIGTERM");
    await stopped;
  }
  await db.delete(user).where(inArray(user.id, owners));
  await rm(profile, {
    force: true,
    maxRetries: 10,
    recursive: true,
    retryDelay: 200,
  });
}
process.exit(0);
