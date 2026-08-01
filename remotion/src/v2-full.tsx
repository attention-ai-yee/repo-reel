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
const MOBILE_SAFE = {
  top: 240,
  right: 240,
  bottom: 470,
  left: 120,
} as const;
const MOBILE_SAFE_WIDTH = 1080 - MOBILE_SAFE.left - MOBILE_SAFE.right;
const MOBILE_SAFE_HEIGHT = 1920 - MOBILE_SAFE.top - MOBILE_SAFE.bottom;
const MOBILE_SAFE_INSET = 16;
const MOBILE_CONTENT_LEFT = MOBILE_SAFE.left + MOBILE_SAFE_INSET;
const MOBILE_CONTENT_RIGHT = MOBILE_SAFE.right + MOBILE_SAFE_INSET;
const MOBILE_CONTENT_WIDTH = MOBILE_SAFE_WIDTH - MOBILE_SAFE_INSET * 2;

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

const MobileSafeOverlay: React.FC = () => {
  const danger = 'rgba(255,67,67,.2)';
  const safeWidth = MOBILE_SAFE_WIDTH;
  const safeHeight = MOBILE_SAFE_HEIGHT;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', fontFamily: uiFont, zIndex: 9999}}>
      <div
        style={{
          position: 'absolute',
          inset: `0 0 auto 0`,
          height: MOBILE_SAFE.top,
          background: danger,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: `auto 0 0 0`,
          height: MOBILE_SAFE.bottom,
          background: danger,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: MOBILE_SAFE.top,
          bottom: MOBILE_SAFE.bottom,
          width: MOBILE_SAFE.left,
          background: danger,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: MOBILE_SAFE.top,
          bottom: MOBILE_SAFE.bottom,
          width: MOBILE_SAFE.right,
          background: danger,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: MOBILE_SAFE.left,
          top: MOBILE_SAFE.top,
          width: safeWidth,
          height: safeHeight,
          border: '4px solid #57FF76',
          boxSizing: 'border-box',
          boxShadow: 'inset 0 0 0 1px rgba(7,10,9,.8)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -39,
            padding: '7px 10px',
            background: '#57FF76',
            color: C.ink,
            fontSize: 15,
            fontWeight: 950,
            letterSpacing: 1.5,
          }}
        >
          DOUYIN SAFE · {safeWidth} × {safeHeight}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 35,
          top: 620,
          display: 'grid',
          gap: 35,
          justifyItems: 'center',
          color: '#fff',
          fontSize: 14,
          fontWeight: 850,
        }}
      >
        {['头像', '点赞', '评论', '分享'].map((label) => (
          <div key={label} style={{textAlign: 'center'}}>
            <div
              style={{
                width: 72,
                height: 72,
                marginBottom: 7,
                borderRadius: '50%',
                border: '3px solid rgba(255,255,255,.88)',
                background: 'rgba(0,0,0,.42)',
              }}
            />
            {label}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 34,
          right: 34,
          bottom: 70,
          height: 245,
          padding: '28px 30px',
          border: '2px dashed rgba(255,255,255,.75)',
          background: 'rgba(0,0,0,.35)',
          color: '#fff',
          fontSize: 23,
          lineHeight: 1.45,
          fontWeight: 800,
        }}
      >
        抖音账号、文案、音乐与底部导航区域
      </div>
    </AbsoluteFill>
  );
};

const Chrome: React.FC<{section: string; accent: string}> = ({
  section,
  accent,
}) => (
  <>
    <div
      style={{
        position: 'absolute',
        left: MOBILE_CONTENT_LEFT,
        top: MOBILE_SAFE.top,
        fontFamily: uiFont,
        fontWeight: 850,
        fontSize: 18,
        letterSpacing: 3,
        color: C.paper,
      }}
    >
      REPOREEL / WEEKLY SIGNAL
    </div>
    <div
      style={{
        position: 'absolute',
        right: MOBILE_CONTENT_RIGHT,
        top: MOBILE_SAFE.top - 3,
        border: `1px solid ${accent}`,
        padding: '8px 12px',
        fontFamily: uiFont,
        fontSize: 16,
        letterSpacing: 2,
        color: accent,
      }}
    >
      {section}
    </div>
    <div
      style={{
        position: 'absolute',
        left: MOBILE_CONTENT_LEFT,
        right: MOBILE_CONTENT_RIGHT,
        top: MOBILE_SAFE.top + 58,
        height: 1,
        background: 'rgba(242,239,231,.2)',
      }}
    />
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
        left: MOBILE_CONTENT_LEFT,
        right: MOBILE_CONTENT_RIGHT,
        top: MOBILE_SAFE.top + 88,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: pop,
        transform: `translateY(${(1 - pop) * 18}px)`,
      }}
    >
      <div
        style={{
          minWidth: 104,
          padding: '12px 14px',
          background: accent,
          color: C.ink,
          textAlign: 'center',
          fontFamily: uiFont,
          fontWeight: 950,
          fontSize: 40,
        }}
      >
        #{String(project.rank).padStart(2, '0')}
      </div>
      <div style={{minWidth: 0, flex: 1}}>
        <div
          style={{
            color: C.paper,
            fontFamily: uiFont,
            fontSize: project.name.length > 28 ? 25 : project.name.length > 22 ? 29 : 36,
            lineHeight: 1.04,
            fontWeight: 950,
            letterSpacing: 0.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {project.name}
        </div>
        <div
          style={{
            marginTop: 8,
            color: accent,
            fontFamily: uiFont,
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {project.owner.toUpperCase()} · +{project.stars_week.toLocaleString('en-US')} / 7 DAYS
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
  const captionFontSize =
    active.text.length > 48
      ? 28
      : active.text.length > 36
        ? 32
        : active.text.length > 28
          ? 36
          : 42;
  return (
    <div
      style={{
        position: 'absolute',
        left: MOBILE_CONTENT_LEFT,
        right: MOBILE_CONTENT_RIGHT,
        bottom: MOBILE_SAFE.bottom + 12,
        padding: '16px 22px 18px',
        borderLeft: `5px solid ${accent}`,
        background:
          'linear-gradient(90deg, rgba(7,10,9,.96), rgba(7,10,9,.88) 82%, rgba(7,10,9,.4))',
        textAlign: 'center',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: captionFontSize,
        lineHeight: 1.28,
        fontWeight: 900,
        letterSpacing: -1.15,
        opacity,
        transform: `translateY(${map(Math.max(0, local), [0, 0.18], [-10, 0])}px)`,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 3,
        overflow: 'hidden',
        wordBreak: 'break-word',
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
      left: MOBILE_CONTENT_LEFT,
      right: MOBILE_CONTENT_RIGHT,
      top: 1165,
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
          minWidth: 0,
          flex: items.length === 1 ? '0 1 auto' : '1 1 0',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
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
  const headlineLength = segment.headline?.length ?? 0;
  const headlineFontSize =
    headlineLength > 32 ? 34 : headlineLength > 24 ? 40 : headlineLength > 18 ? 48 : 60;
  const verdictLength = segment.verdict?.length ?? 0;
  const verdictFontSize = verdictLength > 34 ? 21 : verdictLength > 24 ? 23 : 26;

  const primaryStyle: React.CSSProperties =
    layout === 'focus'
      ? {
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 600,
          height: 560,
        }
      : layout === 'cinematic'
        ? {
            position: 'absolute',
            left: MOBILE_SAFE.left,
            right: MOBILE_SAFE.right,
            top: 610,
            height: 550,
          }
        : layout === 'terminal'
          ? {
              position: 'absolute',
              left: MOBILE_SAFE.left,
              right: MOBILE_SAFE.right,
              top: 610,
              height: 550,
            }
          : layout === 'stack'
            ? {
                position: 'absolute',
                left: 145,
                right: 265,
                top: 620,
                height: 520,
                transform: `rotate(${map(progress, [0, 1], [-2.2, 1.2])}deg)`,
              }
            : {
                position: 'absolute',
                left: MOBILE_SAFE.left,
                right: MOBILE_SAFE.right,
                top: 610,
                height: 480,
              };

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
      />
      <RankStrip project={project} accent={accent} />
      <div
        style={{
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 420,
          fontFamily: editorialFont,
          fontSize: headlineFontSize,
          lineHeight: 1.14,
          fontWeight: 900,
          letterSpacing: headlineFontSize >= 48 ? -2.5 : -1.2,
          color: C.paper,
          opacity: headlineEnter,
          transform: `translateY(${(1 - headlineEnter) * 36}px)`,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: headlineLength > 24 ? 3 : 2,
          maxHeight: 164,
          overflow: 'hidden',
          wordBreak: 'break-word',
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
            style={{
              position: 'absolute',
              left: MOBILE_SAFE.left,
              right: 500,
              top: 610,
              height: 550,
            }}
          />
          <MediaWindow
            visual={segment.secondary_visual}
            accent={accent}
            progress={Math.max(0, progress - 0.12)}
            style={{
              position: 'absolute',
              left: 590,
              right: MOBILE_SAFE.right,
              top: 680,
              height: 470,
            }}
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
                left: 135,
                right: 390,
                top: 650,
                height: 480,
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
            left: MOBILE_SAFE.left + 20,
            top: 1095,
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
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 1210,
          paddingTop: 10,
          borderTop: `3px solid ${accent}`,
          fontFamily: editorialFont,
          fontSize: verdictFontSize,
          lineHeight: 1.24,
          fontWeight: 750,
          color: C.paper,
          opacity: reveal(progress, 0.68, 0.84),
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 2,
          maxHeight: 72,
          overflow: 'hidden',
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
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 330,
          color: C.paper,
          fontFamily: editorialFont,
          fontWeight: 950,
          fontSize: 82,
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
          left: MOBILE_CONTENT_LEFT + 2,
          top: 560,
          color: C.dim,
          fontFamily: uiFont,
          fontSize: 23,
          letterSpacing: 3,
        }}
      >
        TRENDING CANDIDATES / STARS THIS WEEK
      </div>
      <div
        style={{
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 650,
        }}
      >
        {chart.map((item, index) => {
          const appear = reveal(progress, 0.13 + index * 0.055, 0.35 + index * 0.055);
          const width = (item.stars / max) * MOBILE_CONTENT_WIDTH * appear;
          return (
            <div key={item.name} style={{height: 132, position: 'relative'}}>
              <div
                style={{
                  fontFamily: uiFont,
                  fontSize: 22,
                  fontWeight: 850,
                  letterSpacing: 1.5,
                  color: index === 0 ? C.acid : C.paper,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 16,
                }}
              >
                <span
                  style={{
                    minWidth: 0,
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {String(index + 1).padStart(2, '0')} / {item.name}
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    color: index === 0 ? C.acid : C.dim,
                  }}
                >
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
          right: MOBILE_CONTENT_RIGHT,
          bottom: MOBILE_SAFE.bottom + MOBILE_SAFE_INSET,
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
        TOP 10 · COUNTDOWN
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
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 835,
          fontFamily: editorialFont,
          fontSize: 56,
          fontWeight: 950,
          textAlign: 'center',
          lineHeight: 1.08,
          whiteSpace: 'nowrap',
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
          bottom: 520,
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
          left: MOBILE_CONTENT_LEFT,
          top: 390,
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
      <div
        style={{
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 850,
          overflow: 'hidden',
        }}
      >
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
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 330,
          fontFamily: editorialFont,
          fontSize: 78,
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
      <div
        style={{
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 590,
          overflow: 'hidden',
          height: 520,
        }}
      >
        {projects.map((item, index) => {
          const enter = reveal(progress, 0.08 + index * 0.035, 0.25 + index * 0.035);
          return (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: index % 2 ? 358 : 0,
                top: Math.floor(index / 2) * 105,
                width: 330,
                height: 78,
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid rgba(242,239,231,.18)',
                fontFamily: uiFont,
                fontSize: 18,
                color: index >= 7 ? C.acid : C.paper,
                opacity: enter,
                transform: `translateX(${(1 - enter) * (index % 2 ? 70 : -70)}px)`,
              }}
            >
              <span style={{color: C.dim, width: 52, flexShrink: 0}}>
                {String(item.project?.rank).padStart(2, '0')}
              </span>
              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.project?.name.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: MOBILE_CONTENT_LEFT,
          right: MOBILE_CONTENT_RIGHT,
          top: 1105,
          padding: '22px 26px',
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
            fontSize: 42,
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

export const GitHubWeeklyV2MobileSafe: React.FC = () => (
  <AbsoluteFill>
    <GitHubWeeklyV2Full />
    <MobileSafeOverlay />
  </AbsoluteFill>
);

export const fullDurationInFrames = timeline.durationInFrames;
