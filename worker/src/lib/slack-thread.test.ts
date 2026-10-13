import { describe, expect, it, vi } from "vitest";
import { importSlackFiles } from "./slack-thread";
import { SLACK_MAX_FILE_BYTES } from "../../../shared/slack-ticket";

const file = { name: "image.png", mimetype: "image/png", url_private_download: "https://files.slack.com/files-pri/T1-F1/image.png" };
const ticket = { tenantId: "tenant" };
function environment() { return { ATTACHMENTS: { put: vi.fn().mockResolvedValue(undefined) } as any }; }

describe("Slack attachment import", () => {
  it.each(["http://files.slack.com/x", "https://evil.example/x", "https://files.slack.com.evil.example/x", "https://user:pass@files.slack.com/x"])("never sends credentials to %s", async url => {
    const fetch = vi.fn();
    const result = await importSlackFiles(environment(), "test-token", ticket, [{ ...file, url_private_download: url }], fetch);
    expect(fetch).not.toHaveBeenCalled();
    expect(result.saved).toHaveLength(0);
    expect(result.failed).toEqual(["image.png"]);
  });
  it("uses a deadline and refuses automatic redirects", async () => {
    const env = environment();
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { headers: { "content-type": "image/png" } }));
    const result = await importSlackFiles(env, "test-token", ticket, [file], fetch);
    expect(result.saved).toHaveLength(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: "error", signal: expect.any(AbortSignal) });
    expect(env.ATTACHMENTS.put).toHaveBeenCalledOnce();
  });
  it("rejects oversized streamed data even when the Slack metadata understates size", async () => {
    const env = environment();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(SLACK_MAX_FILE_BYTES + 1)); controller.close(); } });
    const fetch = vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-type": "image/png" } }));
    const result = await importSlackFiles(env, "test-token", ticket, [file], fetch);
    expect(result.failed).toEqual(["image.png"]);
    expect(env.ATTACHMENTS.put).not.toHaveBeenCalled();
  });
});
