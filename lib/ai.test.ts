import { afterEach, describe, expect, it, vi } from "vitest";
import { complete, hasKey, isSecureUrl, type AiSettings, type Provider } from "./ai";

const settings = (over: Partial<AiSettings> = {}): AiSettings =>
  ({ provider: "openai", baseUrl: "https://api.example.test", model: "test-model", key: "test-key", ...over });

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("complete on the claude path", () => {
  it("posts to the messages endpoint with the anthropic headers and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "hi" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const s = settings({ provider: "claude", baseUrl: "https://api.example.test/", key: "  test-key  " });
    await expect(complete(s, "sys prompt", "user prompt")).resolves.toBe("hi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/v1/messages");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "content-type": "application/json",
      "x-api-key": "test-key",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "test-model", max_tokens: 4096, system: "sys prompt", messages: [{ role: "user", content: "user prompt" }] });
  });

  it("joins only the text blocks of the reply", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      content: [{ type: "text", text: "a" }, { type: "tool_use", id: "t" }, { type: "text", text: "b" }],
    })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).resolves.toBe("ab");
  });

  it("returns an empty string for an empty content array instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [] })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).resolves.toBe("");
  });

  it("throws long when the reply stops at max_tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "partial" }], stop_reason: "max_tokens" })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).rejects.toThrow("long");
  });

  it("throws refusal when the model refuses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ content: [], stop_reason: "refusal" })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).rejects.toThrow("refusal");
  });

  it("throws the status and provider detail on an http error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529, statusText: "Overloaded" })));
    await expect(complete(settings({ provider: "claude" }), "s", "u")).rejects.toThrow("529 Overloaded: overloaded");
  });
});

describe("complete on the openai-compatible path", () => {
  it("sends bearer auth and omits max_tokens for the openai provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings(), "sys prompt", "user prompt")).resolves.toBe("ok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.test/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json", authorization: "Bearer test-key" });
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "test-model", messages: [{ role: "system", content: "sys prompt" }, { role: "user", content: "user prompt" }] });
    expect(body).not.toHaveProperty("max_tokens");
  });

  it.each(["gemini", "deepseek"] as Provider[])("sends a max_tokens budget to %s", async (provider) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings({ provider }), "s", "u")).resolves.toBe("ok");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens).toBe(4096);
  });

  it("calls a local endpoint without a key and without an authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "local" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const s = settings({ baseUrl: "http://localhost:11434/v1/", key: "" });
    await expect(complete(s, "s", "u")).resolves.toBe("local");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers).toEqual({ "content-type": "application/json" });
  });

  it("joins array content parts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: [{ text: "a" }, {}, { text: "b" }] } }] })));
    await expect(complete(settings(), "s", "u")).resolves.toBe("ab");
  });

  it("throws long when finish_reason is length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "length", message: { content: "partial" } }] })));
    await expect(complete(settings(), "s", "u")).rejects.toThrow("long");
  });

  it("throws the status and provider detail on an http error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401, statusText: "Unauthorized" })));
    await expect(complete(settings(), "s", "u")).rejects.toThrow("401 Unauthorized: bad key");
  });

  it("throws empty when the reply has no content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: {} }] })));
    await expect(complete(settings(), "s", "u")).rejects.toThrow("empty");
  });
});

describe("complete with images", () => {
  const webp = "data:image/webp;base64,UklGRgAAAA==";
  const png = "data:image/png;base64,iVBORw0KGgo=";

  it("sends image_url parts after the text on the openai-compatible path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings(), "sys prompt", "user prompt", undefined, 4096, [webp, png])).resolves.toBe("ok");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "sys prompt" });
    expect(body.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "user prompt" },
        { type: "image_url", image_url: { url: webp } },
        { type: "image_url", image_url: { url: png } },
      ],
    });
  });

  it("sends base64 image blocks before the text on the claude path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "hi" }] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings({ provider: "claude" }), "sys prompt", "user prompt", undefined, 4096, [webp, png])).resolves.toBe("hi");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe("sys prompt");
    expect(body.messages).toEqual([
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/webp", data: "UklGRgAAAA==" } },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" } },
          { type: "text", text: "user prompt" },
        ],
      },
    ]);
  });

  it("skips anything that is not a base64 image data URL on the claude path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "hi" }] }));
    vi.stubGlobal("fetch", fetchMock);
    await complete(settings({ provider: "claude" }), "s", "u", undefined, 4096, ["https://example.test/a.png", "data:text/plain;base64,aGk=", webp]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/webp", data: "UklGRgAAAA==" } },
      { type: "text", text: "u" },
    ]);
  });

  it("keeps plain string content when no images are given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "ok" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    await complete(settings(), "s", "u", undefined, 4096, []);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[1]).toEqual({ role: "user", content: "u" });
  });
});

describe("complete input guards", () => {
  it.each([
    ["insecure", { baseUrl: "http://api.example.test" }],
    ["model", { model: "  " }],
  ])("rejects %s without calling fetch", async (message, over) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(complete(settings(over), "s", "u")).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("hasKey and isSecureUrl", () => {
  it("requires a key for hosted endpoints but not for this machine", () => {
    expect(hasKey(settings())).toBe(true);
    expect(hasKey(settings({ key: "  " }))).toBe(false);
    expect(hasKey(settings({ key: "", baseUrl: "http://localhost:11434/v1" }))).toBe(true);
  });

  it("only allows https or an endpoint on this machine", () => {
    expect(isSecureUrl("https://api.example.test/v1")).toBe(true);
    expect(isSecureUrl("http://localhost:8080/v1")).toBe(true);
    expect(isSecureUrl("http://127.0.0.1:8080/v1")).toBe(true);
    expect(isSecureUrl("http://[::1]:8080/v1")).toBe(true);
    expect(isSecureUrl("http://api.example.test/v1")).toBe(false);
  });
});
