import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "apps/web-tanstack/src/app/pages/StreamOverlay.tsx"),
  "utf8",
);

describe("StreamOverlay remote audio mapping", () => {
  it("consumes streamAudioControl from hook", () => {
    expect(source).toContain("streamAudioControl");
  });

  it("maps playback intent to audio controls", () => {
    expect(source).toContain('streamAudioControl.playbackIntent === "paused"');
    expect(source).toContain('streamAudioControl.playbackIntent === "stopped"');
    expect(source).toContain("resumeMusic()");
    expect(source).toContain("pauseMusic()");
    expect(source).toContain("stopMusic()");
  });

  it("applies remote mute and volume state", () => {
    expect(source).toContain("setMusicVolume(streamAudioControl.musicVolume)");
    expect(source).toContain("setSfxVolume(streamAudioControl.sfxVolume)");
    expect(source).toContain("setMusicMuted(streamAudioControl.musicMuted)");
    expect(source).toContain("setSfxMuted(streamAudioControl.sfxMuted)");
  });
});
