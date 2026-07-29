import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import fullTimelineJson from './generated/full-timeline.json';

const C = {
  ink: '#070A09',
  paper: '#F2EFE7',
  acid: '#C8FF36',
  orange: '#FF6B45',
  blue: '#4DC7FF',
  yellow: '#FFD45B',
  dim: '#8D968F',
  panel: '#101412',
};

type Boundary = {
  text: string;
  start: number;
  duration: number;
  boundary: string;
};

type Project = {
  rank: number;
  owner: string;
  name: string;
  url: string;
  stars_week: number;
};

type Visual = {
  type: 'image' | 'video';
  path: string;
  label: string;
  fit?: 'cover' | 'contain';
  position?: 'top' | 'center' | 'bottom';
};

type ChartItem = {
  name: string;
  stars: number;
};

export type FullSegment = {
  id: string;
  kind: 'silent' | 'spoken';
  spoken?: string;
  onscreen: string[];
  audio?: string;
  audioSeconds?: number;
  startFrame: number;
  durationInFrames: number;
  words: Boundary[];
  layout?: 'split' | 'cinematic' | 'signal' | 'terminal' | 'stack' | 'focus';
  accent?: string;
  headline?: string;
  verdict?: string;
  facts?: string[];
  project?: Project;
  visual?: Visual;
  secondary_visual?: Visual;
  chart?: ChartItem[];
};

const timeline = fullTimelineJson as {
  fps: number;
  durationInFrames: number;
  voice: string;
  segments: FullSegment[];
};
const scopeDate =
  timeline.segments
    .find((segment) => segment.id === 'scope')
    ?.onscreen.find((item) => item.startsWith('CAPTURED '))
    ?.replace('CAPTURED ', '') ?? 'WEEKLY';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const editorialFont = '"Noto Serif SC", "Source Han Serif SC", serif';
const uiFont = '"Bahnschrift", "Noto Sans SC", sans-serif';

const map = (
  value: number,
  input: [number, number],
  output: [number, number],
) => interpolate(value, input, output, clamp);

const reveal = (progress: number, start: number, end: number) =>
  map(progress, [start, end], [0, 1]);

const Noise: React.FC<{opacity?: number}> = ({opacity = 0.085}) => (
  <AbsoluteFill
    style={{
      opacity,
      mixBlendMode: 'screen',
      backgroundImage:
        'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,.5) 0 .65px, transparent .75px 3px)',
      backgroundSize: '5px 5px',
      pointerEvents: 'none',
    }}
  />
);

const Grid: React.FC<{color?: string; opacity?: number}> = ({
  color = C.paper,
  opacity = 0.065,
}) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: '78px 78px',
      maskImage: 'linear-gradient(to bottom, black, transparent 82%)',
    }}
  />
);

const Chrome: React.FC<{section: string; accent: string; source?: string}> = ({
  section,
  accent,
  source,
}) => (
  <>
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 45,
        fontFamily: uiFont,
        fontWeight: 850,
        fontSize: 21,
        letterSpacing: 3.6,
        color: C.paper,
      }}
    >
      REPOREEL / WEEKLY SIGNAL
    </div>
    <div
      style={{
        position: 'absolute',
        right: 54,
        top: 42,
        border: `1px solid ${accent}`,
        padding: '8px 12px',
        fontFamily: uiFont,
        fontSize: 17,
        letterSpacing: 2,
        color: accent,
      }}
    >
      {section}
    </div>
    <div
      style={{
        position: 'absolute',
        left: 54,
        right: 54,
        top: 96,
        height: 1,
        background: 'rgba(242,239,231,.2)',
      }}
    />
    {source ? (
      <div
        style={{
          position: 'absolute',
          left: 55,
          bottom: 46,
          fontFamily: uiFont,
          fontSize: 15,
          letterSpacing: 1.2,
          color: C.dim,
        }}
      >
        SOURCE / {source}
      </div>
    ) : null}
  </>
);

const RankStrip: React.FC<{project: Project; accent: string}> = ({
  project,
  accent,
}) => {
  const frame = useCurrentFrame();
  const pop = spring({
    frame,
    fps: timeline.fps,
    config: {damping: 15, stiffness: 180, mass: 0.8},
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 55,
        top: 128,
        display: 'flex',
        alignItems: 'center',
        gap: 17,
        opacity: pop,
        transform: `translateX(${(1 - pop) * -48}px)`,
      }}
    >
      <div
        style={{
          minWidth: 102,
          padding: '9px 14px',
          background: accent,
          color: C.ink,
          textAlign: 'center',
          fontFamily: uiFont,
          fontWeight: 950,
          fontSize: 37,
        }}
      >
        #{String(project.rank).padStart(2, '0')}
      </div>
      <div>
        <div
          style={{
            color: accent,
            fontFamily: uiFont,
            fontSize: 24,
            fontWeight: 850,
            letterSpacing: 1.8,
          }}
        >
          +{project.stars_week.toLocaleString('en-US')} / 7 DAYS
        </div>
        <div
          style={{
            marginTop: 4,
            color: C.dim,
            fontFamily: uiFont,
            fontSize: 16,
            letterSpacing: 1.4,
          }}
        >
          {project.owner.toUpperCase()} / {project.name.toUpperCase()}
        </div>
      </div>
    </div>
  );
};

const hotPattern =
  /(Agent|AI|Codex|Claude Code|WiFi|CSI|ESP32|SQL|Git|PDF|EPUB|macOS|沙箱|第一名|前五名|一万五千|九十二个|两百九十)/gi;
const hotTest =
  /^(Agent|AI|Codex|Claude Code|WiFi|CSI|ESP32|SQL|Git|PDF|EPUB|macOS|沙箱|第一名|前五名|一万五千|九十二个|两百九十)$/i;

const Highlighted: React.FC<{text: string; accent: string}> = ({text, accent}) => (
  <>
    {text.split(hotPattern).map((token, index) => (
      <span
        key={`${token}-${index}`}
        style={{color: hotTest.test(token) ? accent : C.paper}}
      >
        {token}
      </span>
    ))}
  </>
);

const CaptionTrack: React.FC<{segment: FullSegment; accent: string}> = ({
  segment,
  accent,
}) => {
  const frame = useCurrentFrame();
  if (segment.kind !== 'spoken' || segment.words.length === 0) return null;
  const seconds = frame / timeline.fps;
  const active =
    segment.words.find(
      (word) =>
        seconds >= Math.max(0, word.start - 0.04) &&
        seconds <= word.start + word.duration + 0.08,
    ) ??
    (seconds > segment.words[segment.words.length - 1].start
      ? segment.words[segment.words.length - 1]
      : segment.words[0]);
  const local = seconds - active.start;
  const opacity =
    Math.min(1, Math.max(0, local / 0.12)) *
    Math.min(1, Math.max(0, (active.duration + 0.12 - local) / 0.14));
  return (
    <div
      style={{
        position: 'absolute',
        left: 64,
        right: 64,
        bottom: 112,
        textAlign: 'center',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 46,
        lineHeight: 1.32,
        fontWeight: 900,
        letterSpacing: -1.15,
        opacity,
        transform: `translateY(${map(Math.max(0, local), [0, 0.18], [16, 0])}px)`,
        textShadow:
          '0 3px 0 #070A09, 3px 0 0 #070A09, -3px 0 0 #070A09, 0 -3px 0 #070A09, 0 8px 26px rgba(0,0,0,.92)',
      }}
    >
      <Highlighted text={active.text} accent={accent} />
    </div>
  );
};

const MediaContent: React.FC<{visual: Visual; motion: number}> = ({
  visual,
  motion,
}) => {
  const position =
    visual.position === 'top'
      ? 'center top'
      : visual.position === 'bottom'
        ? 'center bottom'
        : 'center center';
  const style: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: visual.fit ?? 'cover',
    objectPosition: position,
    transform: `scale(${1.015 + motion * 0.045}) translateY(${(motion - 0.5) * -14}px)`,
  };
  return visual.type === 'video' ? (
    <OffthreadVideo
      src={staticFile(visual.path)}
      muted
      playbackRate={0.58}
      style={style}
    />
  ) : (
    <Img src={staticFile(visual.path)} style={style} />
  );
};

const MediaWindow: React.FC<{
  visual: Visual;
  accent: string;
  progress: number;
  style?: React.CSSProperties;
}> = ({visual, accent, progress, style}) => {
  const enter = reveal(progress, 0.06, 0.23);
  return (
    <div
      style={{
        overflow: 'hidden',
        background: C.panel,
        border: `1px solid ${accent}88`,
        boxShadow: '0 34px 95px rgba(0,0,0,.62)',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 52}px) scale(${0.965 + enter * 0.035})`,
        ...style,
      }}
    >
      <div
        style={{
          height: 45,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 15px',
          borderBottom: '1px solid rgba(242,239,231,.14)',
          color: C.dim,
          fontFamily: uiFont,
          fontSize: 15,
          letterSpacing: 1.2,
        }}
      >
        <i style={{width: 9, height: 9, borderRadius: '50%', background: '#FF5B4B'}} />
        <i style={{width: 9, height: 9, borderRadius: '50%', background: C.yellow}} />
        <i style={{width: 9, height: 9, borderRadius: '50%', background: accent}} />
        <span style={{marginLeft: 8}}>{visual.label}</span>
      </div>
      <div style={{height: 'calc(100% - 45px)', overflow: 'hidden'}}>
        <MediaContent visual={visual} motion={progress} />
      </div>
    </div>
  );
};

const Facts: React.FC<{items: string[]; accent: string; progress: number}> = ({
  items,
  accent,
  progress,
}) => (
  <div
    style={{
      position: 'absolute',
      left: 56,
      top: 1392,
      display: 'flex',
      gap: 12,
      opacity: reveal(progress, 0.6, 0.76),
    }}
  >
    {items.map((item, index) => (
      <span
        key={item}
        style={{
          padding: '11px 14px',
          border: `1px solid ${index === 0 ? accent : '#4D5651'}`,
          background: index === 0 ? accent : 'rgba(242,239,231,.055)',
          color: index === 0 ? C.ink : C.paper,
          fontFamily: uiFont,
          fontWeight: 850,
          fontSize: 17,
          letterSpacing: 1.15,
        }}
      >
        {item}
      </span>
    ))}
  </div>
);

const SignalField: React.FC<{accent: string; progress: number}> = ({
  accent,
  progress,
}) => (
  <svg
    viewBox="0 0 1080 1920"
    style={{position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.34}}
  >
    {[0, 1, 2, 3].map((index) => {
      const radius = 110 + index * 110 + progress * 70;
      return (
        <circle
          key={index}
          cx="890"
          cy="390"
          r={radius}
          fill="none"
          stroke={accent}
          strokeWidth="3"
          opacity={0.7 - index * 0.13}
          strokeDasharray={`${18 + index * 4} 15`}
        />
      );
    })}
  </svg>
);

const ProjectScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const progress = frame / segment.durationInFrames;
  const accent = segment.accent ?? C.acid;
  if (!segment.project || !segment.visual) {
    throw new Error(`Project scene "${segment.id}" lacks project or visual metadata`);
  }
  const project = segment.project;
  const headlineEnter = reveal(progress, 0.02, 0.18);
  const layout = segment.layout ?? 'cinematic';

  const primaryStyle: React.CSSProperties =
    layout === 'focus'
      ? {position: 'absolute', left: 35, right: 35, top: 515, height: 845}
      : layout === 'cinematic'
        ? {position: 'absolute', left: 58, right: 58, top: 550, height: 800}
        : layout === 'terminal'
          ? {position: 'absolute', left: 55, right: 55, top: 535, height: 805}
          : layout === 'stack'
            ? {
                position: 'absolute',
                left: 145,
                right: 145,
                top: 555,
                height: 720,
                transform: `rotate(${map(progress, [0, 1], [-2.2, 1.2])}deg)`,
              }
            : {position: 'absolute', left: 48, right: 48, top: 525, height: 500};

  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      <Grid color={accent} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 84% 22%, ${accent}20, transparent 34%), radial-gradient(circle at 5% 78%, ${accent}12, transparent 42%)`,
        }}
      />
      {layout === 'signal' ? <SignalField accent={accent} progress={progress} /> : null}
      <Chrome
        section={`RANK ${String(project.rank).padStart(2, '0')}`}
        accent={accent}
        source={`${project.owner}/${project.name}`}
      />
      <RankStrip project={project} accent={accent} />
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 250,
          fontFamily: editorialFont,
          fontSize: segment.headline && segment.headline.length > 18 ? 60 : 68,
          lineHeight: 1.12,
          fontWeight: 900,
          letterSpacing: -2.7,
          color: C.paper,
          opacity: headlineEnter,
          transform: `translateY(${(1 - headlineEnter) * 36}px)`,
        }}
      >
        {segment.headline}
      </div>

      {layout === 'split' && segment.secondary_visual ? (
        <>
          <MediaWindow
            visual={segment.visual}
            accent={accent}
            progress={progress}
            style={{position: 'absolute', left: 48, right: 410, top: 535, height: 790}}
          />
          <MediaWindow
            visual={segment.secondary_visual}
            accent={accent}
            progress={Math.max(0, progress - 0.12)}
            style={{position: 'absolute', left: 650, right: 48, top: 635, height: 590}}
          />
        </>
      ) : (
        <>
          {layout === 'stack' && segment.secondary_visual ? (
            <MediaWindow
              visual={segment.secondary_visual}
              accent={accent}
              progress={progress}
              style={{
                position: 'absolute',
                left: 60,
                right: 260,
                top: 590,
                height: 650,
                transform: 'rotate(-4deg)',
                opacity: 0.55,
              }}
            />
          ) : null}
          <MediaWindow
            visual={segment.visual}
            accent={accent}
            progress={progress}
            style={primaryStyle}
          />
        </>
      )}

      {layout === 'terminal' ? (
        <div
          style={{
            position: 'absolute',
            left: 82,
            top: 1220,
            padding: '14px 18px',
            background: '#050706',
            borderLeft: `5px solid ${accent}`,
            color: accent,
            fontFamily: '"Cascadia Code", monospace',
            fontSize: 20,
            opacity: reveal(progress, 0.5, 0.7),
          }}
        >
          $ pi install · extensions · skills · themes
        </div>
      ) : null}

      <Facts items={segment.facts ?? []} accent={accent} progress={progress} />
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          top: 1460,
          paddingTop: 20,
          borderTop: `3px solid ${accent}`,
          fontFamily: editorialFont,
          fontSize: 31,
          lineHeight: 1.35,
          fontWeight: 750,
          color: C.paper,
          opacity: reveal(progress, 0.68, 0.84),
        }}
      >
        <span style={{color: accent, marginRight: 12}}>EDITOR NOTE /</span>
        {segment.verdict}
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const HookScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const progress = frame / segment.durationInFrames;
  const chart = segment.chart ?? [];
  const max = Math.max(...chart.map((item) => item.stars), 1);
  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      <Grid color={C.acid} opacity={0.08} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 78% 18%, rgba(200,255,54,.22), transparent 38%)',
        }}
      />
      <Chrome section={scopeDate.replaceAll('-', ' / ')} accent={C.acid} />
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 188,
          color: C.paper,
          fontFamily: editorialFont,
          fontWeight: 950,
          fontSize: 94,
          lineHeight: 0.98,
          letterSpacing: -5,
          transform: `translateY(${(1 - reveal(progress, 0.01, 0.2)) * 55}px)`,
          opacity: reveal(progress, 0.01, 0.2),
        }}
      >
        GITHUB
        <br />
        <span style={{color: C.acid}}>WEEKLY TOP 10</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 57,
          top: 425,
          color: C.dim,
          fontFamily: uiFont,
          fontSize: 23,
          letterSpacing: 3,
        }}
      >
        TRENDING CANDIDATES / STARS THIS WEEK
      </div>
      <div style={{position: 'absolute', left: 55, right: 55, top: 530}}>
        {chart.map((item, index) => {
          const appear = reveal(progress, 0.13 + index * 0.055, 0.35 + index * 0.055);
          const width = (item.stars / max) * 860 * appear;
          return (
            <div key={item.name} style={{height: 154, position: 'relative'}}>
              <div
                style={{
                  fontFamily: uiFont,
                  fontSize: 22,
                  fontWeight: 850,
                  letterSpacing: 1.5,
                  color: index === 0 ? C.acid : C.paper,
                  marginBottom: 10,
                }}
              >
                {String(index + 1).padStart(2, '0')} / {item.name}
                <span style={{float: 'right', color: index === 0 ? C.acid : C.dim}}>
                  +{item.stars.toLocaleString('en-US')}
                </span>
              </div>
              <div style={{height: 48, background: 'rgba(242,239,231,.07)'}}>
                <div
                  style={{
                    width,
                    height: '100%',
                    background: index === 0 ? C.acid : index < 3 ? C.blue : '#46504B',
                    boxShadow: index === 0 ? '0 0 38px rgba(200,255,54,.35)' : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 54,
          bottom: 222,
          padding: '16px 20px',
          background: C.acid,
          color: C.ink,
          fontFamily: uiFont,
          fontWeight: 950,
          fontSize: 24,
          letterSpacing: 2,
          opacity: reveal(progress, 0.64, 0.8),
        }}
      >
        3 MINUTES · COUNTDOWN
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const ScopeScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const enter = spring({frame, fps: timeline.fps, config: {damping: 16, stiffness: 155}});
  return (
    <AbsoluteFill
      style={{
        background: C.acid,
        color: C.ink,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          fontFamily: uiFont,
          fontSize: 210,
          fontWeight: 950,
          opacity: 0.09,
          whiteSpace: 'nowrap',
          transform: `translateX(${-frame * 7}px)`,
        }}
      >
        WEEKLY WEEKLY WEEKLY
      </div>
      <div
        style={{
          fontFamily: editorialFont,
          fontSize: 74,
          fontWeight: 950,
          textAlign: 'center',
          lineHeight: 1.08,
          transform: `scale(${0.82 + enter * 0.18})`,
        }}
      >
        GITHUB TRENDING
        <br />
        WEEKLY CANDIDATES
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 540,
          padding: '10px 15px',
          border: '2px solid #070A09',
          fontFamily: uiFont,
          fontSize: 19,
          letterSpacing: 2,
          fontWeight: 850,
        }}
      >
        {(segment.onscreen.find((item) => item.startsWith('CAPTURED ')) ?? 'CAPTURED')
          .replace('CAPTURED ', 'CAPTURED / ')}
      </div>
    </AbsoluteFill>
  );
};

const MidResetScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const progress = frame / segment.durationInFrames;
  const pop = spring({
    frame: frame - Math.round(segment.durationInFrames * 0.18),
    fps: timeline.fps,
    config: {damping: 12, stiffness: 170},
  });
  const labels = ['GATEWAY', 'BOOK', 'INTEL', 'SKILLS', 'TEAM'];
  return (
    <AbsoluteFill style={{background: C.acid, color: C.ink, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: -140,
          top: 160,
          fontFamily: uiFont,
          fontSize: 230,
          fontWeight: 950,
          opacity: 0.085,
          whiteSpace: 'nowrap',
          transform: `translateX(${-frame * 5}px)`,
        }}
      >
        TOP FIVE TOP FIVE TOP FIVE
      </div>
      <div
        style={{
          position: 'absolute',
          left: 55,
          top: 420,
          fontFamily: editorialFont,
          fontSize: 176,
          lineHeight: 0.86,
          fontWeight: 950,
          letterSpacing: -8,
          transform: `scale(${0.72 + pop * 0.28})`,
          transformOrigin: 'left center',
        }}
      >
        TOP
        <br />
        FIVE.
      </div>
      <div style={{position: 'absolute', left: 58, right: 58, top: 900}}>
        {labels.map((label, index) => (
          <div
            key={label}
            style={{
              height: 102,
              display: 'flex',
              alignItems: 'center',
              borderBottom: '2px solid rgba(7,10,9,.25)',
              fontFamily: uiFont,
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: 3,
              opacity: reveal(progress, 0.26 + index * 0.07, 0.45 + index * 0.07),
              transform: `translateX(${(1 - reveal(progress, 0.26 + index * 0.07, 0.45 + index * 0.07)) * 90}px)`,
            }}
          >
            <span style={{width: 80}}>0{5 - index}</span>
            {label}
            <span style={{marginLeft: 'auto'}}>→</span>
          </div>
        ))}
      </div>
      <CaptionTrack segment={segment} accent={C.ink} />
    </AbsoluteFill>
  );
};

const OutroScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const progress = frame / segment.durationInFrames;
  const projects = timeline.segments
    .filter((item) => item.project)
    .sort((a, b) => (b.project?.rank ?? 0) - (a.project?.rank ?? 0));
  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      <Grid color={C.acid} opacity={0.08} />
      <Chrome section="END / 10" accent={C.acid} />
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 185,
          fontFamily: editorialFont,
          fontSize: 92,
          fontWeight: 950,
          lineHeight: 0.98,
          letterSpacing: -4.5,
          color: C.paper,
        }}
      >
        10 PROJECTS.
        <br />
        <span style={{color: C.acid}}>ONE WEEK.</span>
      </div>
      <div style={{position: 'absolute', left: 55, right: 55, top: 515}}>
        {projects.map((item, index) => {
          const enter = reveal(progress, 0.08 + index * 0.035, 0.25 + index * 0.035);
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: index % 2 ? 480 : 0,
                top: Math.floor(index / 2) * 115,
                width: 450,
                height: 84,
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid rgba(242,239,231,.18)',
                fontFamily: uiFont,
                fontSize: 20,
                color: index >= 7 ? C.acid : C.paper,
                opacity: enter,
                transform: `translateX(${(1 - enter) * (index % 2 ? 70 : -70)}px)`,
              }}
            >
              <span style={{color: C.dim, width: 52}}>
                {String(item.project?.rank).padStart(2, '0')}
              </span>
              {item.project?.name.toUpperCase()}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 1170,
          padding: '32px 34px',
          background: C.acid,
          color: C.ink,
          opacity: reveal(progress, 0.52, 0.7),
          transform: `translateY(${(1 - reveal(progress, 0.52, 0.7)) * 48}px)`,
        }}
      >
        <div style={{fontFamily: uiFont, fontSize: 22, letterSpacing: 3, fontWeight: 900}}>
          NEXT / REAL TEST
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: editorialFont,
            fontSize: 52,
            fontWeight: 950,
          }}
        >
          你最想先看哪个？
        </div>
      </div>
      <CaptionTrack segment={segment} accent={C.acid} />
      <Noise />
    </AbsoluteFill>
  );
};

const Scene: React.FC<{segment: FullSegment}> = ({segment}) => {
  if (segment.id === 'hook') return <HookScene segment={segment} />;
  if (segment.id === 'scope') return <ScopeScene segment={segment} />;
  if (segment.id === 'mid_reset') return <MidResetScene segment={segment} />;
  if (segment.id === 'outro') return <OutroScene segment={segment} />;
  if (segment.project) {
    const accent = segment.accent ?? C.acid;
    return (
      <>
        <ProjectScene segment={segment} />
        <CaptionTrack segment={segment} accent={accent} />
      </>
    );
  }
  throw new Error(`No scene registered for "${segment.id}"`);
};

export const GitHubWeeklyV2Full: React.FC = () => {
  const firstSpoken = timeline.segments.find((segment) => segment.kind === 'spoken');
  if (!firstSpoken) throw new Error('Full timeline has no spoken segments');
  return (
    <AbsoluteFill style={{background: C.ink}}>
      {timeline.segments.map((segment) => (
        <Sequence
          key={segment.id}
          from={segment.startFrame}
          durationInFrames={segment.durationInFrames}
          premountFor={30}
        >
          <Scene segment={segment} />
          {segment.audio ? <Audio src={staticFile(segment.audio)} volume={1} /> : null}
        </Sequence>
      ))}
      <Sequence
        from={firstSpoken.startFrame}
        durationInFrames={timeline.durationInFrames - firstSpoken.startFrame}
      >
        <Audio src={staticFile('audio/full-bed.wav')} volume={0.115} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const fullDurationInFrames = timeline.durationInFrames;
