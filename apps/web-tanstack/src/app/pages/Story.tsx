import { StoryProvider, ChapterMap, StoryIntro, DialogueBox } from "@/components/story";
import { AgentOverlayNav } from "@/components/layout/AgentOverlayNav";

export function Story() {
  return (
    <StoryProvider>
      <ChapterMap />
      <StoryIntro />
      <DialogueBox />
      <AgentOverlayNav active="story" />
    </StoryProvider>
  );
}
