import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("reconnect shows pressed feedback and navigates to authorization, including keyboard clicks", async () => {
  const source = await readFile("public/setup/setup.js", "utf8");
  const handlers: Record<string, Function> = {}, classes = new Set<string>(), attributes = new Map();
  const button = { href: "http://localhost/auth/start", textContent: "Connect Twitch", classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) }, setAttribute: (name: string, value: string) => attributes.set(name,value), removeAttribute: (name: string) => attributes.delete(name), addEventListener: (name: string, fn: Function) => { handlers[name] = fn; } };
  const status = { textContent: "" }, assign = vi.fn(); let pending: Function | undefined;
  await runInNewContext(`(async()=>{${source}})()`, { URLSearchParams, location: { search: "?connected=1", assign }, document: { querySelector: (selector: string) => selector === ".connect" ? button : status }, addEventListener: (name: string, fn: Function) => { handlers[name] = fn; }, setTimeout: (fn: Function, delay: number) => { expect(delay).toBe(160); pending = fn; } });
  expect(button.textContent).toBe("Reconnect Twitch");
  const preventDefault = vi.fn(); handlers.click!({ button: 0, preventDefault });
  expect(preventDefault).toHaveBeenCalled(); expect(classes.has("pressed")).toBe(true); expect(status.textContent).toBe("Opening Twitch…"); expect(assign).not.toHaveBeenCalled();
  pending!(); expect(assign).toHaveBeenCalledWith(button.href);
  handlers.pageshow!(); expect(classes.has("pressed")).toBe(false); expect(attributes.has("aria-busy")).toBe(false);
});
