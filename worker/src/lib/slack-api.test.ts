import { afterEach, expect, it, vi } from "vitest";
import { isAllowedSlackTeam } from "./slack-api";

afterEach(() => vi.unstubAllGlobals());

it("confirms the workspace using the installed bot when no allowlist is configured", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, team_id: "TINSTALLED" })));
  vi.stubGlobal("fetch", fetch);
  const env = { SLACK_BOT_TOKEN: "test-installed-token" };
  expect(await isAllowedSlackTeam(env, "TINSTALLED")).toBe(true);
  expect(await isAllowedSlackTeam(env, "TOUTSIDE")).toBe(false);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(String(fetch.mock.calls[0][0])).toContain("auth.test");
});

it("fails closed when Slack cannot confirm the bot workspace", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "invalid_auth" }))));
  expect(await isAllowedSlackTeam({ SLACK_BOT_TOKEN: "test-invalid-token" }, "TINSTALLED")).toBe(false);
  expect(await isAllowedSlackTeam({}, "TINSTALLED")).toBe(false);
  expect(await isAllowedSlackTeam({ SLACK_ALLOWED_TEAM_ID: "TINSTALLED" }, null)).toBe(false);
});

it("enforces the explicit workspace allowlist without calling Slack", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect(await isAllowedSlackTeam({ SLACK_ALLOWED_TEAM_IDS: "TONE, TTWO" }, "TTWO")).toBe(true);
  expect(await isAllowedSlackTeam({ SLACK_ALLOWED_TEAM_IDS: "TONE, TTWO" }, "TOUTSIDE")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
