import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentOverlayNav } from "./AgentOverlayNav";

const navigateMock = vi.fn();

vi.mock("@/router/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@/hooks/auth/usePostLoginRedirect", () => ({
  storeRedirect: vi.fn(),
}));

vi.mock("@/lib/auth/privyEnv", () => ({
  PRIVY_ENABLED: false,
}));

describe("AgentOverlayNav", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renders agent-focused navigation labels", () => {
    const html = renderToStaticMarkup(createElement(AgentOverlayNav, { active: "home" }));
    expect(html).toContain("Home");
    expect(html).toContain("Story");
    expect(html).toContain("Agent PvP");
    expect(html).toContain("Watch");
  });

  it("marks the active route button as the current page", () => {
    const html = renderToStaticMarkup(createElement(AgentOverlayNav, { active: "watch" }));
    expect(html).toContain('aria-current="page"');
  });
});
