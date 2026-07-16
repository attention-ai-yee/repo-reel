import React from 'react';
import {Composition} from 'remotion';
import timeline from './generated/pilot-timeline.json';
import {fullDurationInFrames, GitHubWeeklyV2Full} from './v2-full';
import {GitHubWeeklyV2Pilot} from './v2-pilot';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GitHubWeeklyV2Pilot"
        component={GitHubWeeklyV2Pilot}
        durationInFrames={timeline.durationInFrames}
        fps={timeline.fps}
        width={1080}
        height={1920}
      />
      <Composition
        id="GitHubWeeklyV2Full"
        component={GitHubWeeklyV2Full}
        durationInFrames={fullDurationInFrames}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
