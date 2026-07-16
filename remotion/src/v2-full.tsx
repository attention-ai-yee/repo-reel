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
  orange: '#FF5B36',
  blue: '#4DC7FF',
  yellow: '#FFD45B',
  dim: '#8D968F',
  red: '#FF3B32',
};

type Boundary = {
  text: string;
  start: number;
  duration: number;
  boundary: string;
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
};

const timeline = fullTimelineJson as {
  fps: number;
  durationInFrames: number;
  voice: string;
  segments: FullSegment[];
};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const editorialFont = '"Noto Serif SC", "Source Han Serif SC", serif';
const uiFont = '"Bahnschrift", "Noto Sans SC", sans-serif';

const map = (
  value: number,
  input: [number, number],
  output: [number, number],
) => interpolate(value, input, output, clamp);

const phase = (progress: number, start: number, end: number) =>
  map(progress, [start, end], [0, 1]);

const Noise: React.FC<{opacity?: number}> = ({opacity = 0.09}) => (
  <AbsoluteFill
    style={{
      opacity,
      mixBlendMode: 'screen',
      backgroundImage:
        'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,.52) 0 0.65px, transparent .75px 3px)',
      backgroundSize: '5px 5px',
      pointerEvents: 'none',
    }}
  />
);

const Grid: React.FC<{color?: string; opacity?: number}> = ({
  color = C.paper,
  opacity = 0.08,
}) => (
  <AbsoluteFill
    style={{
      opacity,
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: '78px 78px',
      maskImage: 'linear-gradient(to bottom, black, transparent 80%)',
    }}
  />
);

const FrameChrome: React.FC<{
  section: string;
  accent?: string;
  source?: string;
}> = ({section, accent = C.acid, source}) => (
  <>
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 48,
        fontFamily: uiFont,
        fontWeight: 800,
        fontSize: 22,
        letterSpacing: 3.8,
        color: C.paper,
      }}
    >
      GH / WEEKLY SIGNAL
    </div>
    <div
      style={{
        position: 'absolute',
        right: 54,
        top: 45,
        border: `1px solid ${accent}`,
        padding: '8px 12px',
        fontFamily: uiFont,
        fontSize: 18,
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
        top: 98,
        height: 1,
        background: 'rgba(242,239,231,.2)',
      }}
    />
    {source ? (
      <div
        style={{
          position: 'absolute',
          left: 55,
          bottom: 48,
          fontFamily: uiFont,
          fontSize: 16,
          letterSpacing: 1.5,
          color: C.dim,
        }}
      >
        SOURCE / {source}
      </div>
    ) : null}
  </>
);

const RankTag: React.FC<{
  rank: string;
  stars: string;
  color: string;
}> = ({rank, stars, color}) => {
  const frame = useCurrentFrame();
  const bounce = spring({
    frame,
    fps: timeline.fps,
    config: {damping: 15, stiffness: 190, mass: 0.8},
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 55,
        top: 138,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: bounce,
        transform: `translateX(${(1 - bounce) * -45}px)`,
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          background: color,
          color: C.ink,
          fontFamily: uiFont,
          fontWeight: 900,
          fontSize: 38,
        }}
      >
        {rank}
      </div>
      <div
        style={{
          fontFamily: uiFont,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 2,
          color,
        }}
      >
        {stars} / THIS WEEK
      </div>
    </div>
  );
};

const Window: React.FC<{
  children: React.ReactNode;
  label: string;
  accent?: string;
  style?: React.CSSProperties;
}> = ({children, label, accent = C.acid, style}) => (
  <div
    style={{
      overflow: 'hidden',
      background: '#101412',
      border: `1px solid ${accent}66`,
      boxShadow: '0 32px 90px rgba(0,0,0,.58)',
      ...style,
    }}
  >
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0 17px',
        borderBottom: '1px solid rgba(242,239,231,.14)',
        color: C.dim,
        fontFamily: uiFont,
        fontSize: 16,
      }}
    >
      <i style={{width: 10, height: 10, borderRadius: '50%', background: C.red}} />
      <i style={{width: 10, height: 10, borderRadius: '50%', background: C.yellow}} />
      <i style={{width: 10, height: 10, borderRadius: '50%', background: C.acid}} />
      <span style={{marginLeft: 10}}>{label}</span>
    </div>
    <div style={{height: 'calc(100% - 48px)', overflow: 'hidden'}}>{children}</div>
  </div>
);

const highlight = (text: string) => {
  const hot =
    /(AI|Agent|RAG|MCP|API|Codex|Cursor|Claude Code|Git|Word|Excel|PowerPoint|Star|工作流|本机|不必上云|自动切换|统一接入|开源版|第一名|前五名)/i;
  return text.split(hot).map((token, index) => (
    <span
      key={`${token}-${index}`}
      style={{color: hot.test(token) ? C.acid : C.paper}}
    >
      {token}
    </span>
  ));
};

const CaptionTrack: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  if (segment.kind !== 'spoken' || segment.words.length === 0) return null;
  const seconds = frame / timeline.fps;
  const active =
    segment.words.find(
      (word) =>
        seconds >= Math.max(0, word.start - 0.05) &&
        seconds <= word.start + word.duration + 0.08,
    ) ??
    (seconds > segment.words[segment.words.length - 1].start
      ? segment.words[segment.words.length - 1]
      : segment.words[0]);
  const local = seconds - active.start;
  const opacity =
    Math.min(1, Math.max(0, local / 0.14)) *
    Math.min(1, Math.max(0, (active.duration + 0.12 - local) / 0.16));
  const y = map(Math.max(0, local), [0, 0.2], [18, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: 70,
        right: 70,
        bottom: 135,
        textAlign: 'center',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontSize: 47,
        lineHeight: 1.34,
        fontWeight: 850,
        letterSpacing: -1.2,
        opacity,
        transform: `translateY(${y}px)`,
        textShadow:
          '0 3px 0 #070A09, 3px 0 0 #070A09, -3px 0 0 #070A09, 0 -3px 0 #070A09, 0 8px 26px rgba(0,0,0,.9)',
      }}
    >
      {highlight(active.text)}
    </div>
  );
};

const BigTitle: React.FC<{
  children: React.ReactNode;
  top?: number;
  size?: number;
}> = ({children, top = 238, size = 68}) => (
  <div
    style={{
      position: 'absolute',
      left: 55,
      right: 55,
      top,
      fontFamily: editorialFont,
      fontSize: size,
      fontWeight: 850,
      lineHeight: 1.13,
      letterSpacing: -3.2,
      color: C.paper,
    }}
  >
    {children}
  </div>
);

const PilotClipScene: React.FC<{segment: FullSegment}> = () => (
  <AbsoluteFill style={{background: C.ink}}>
    <OffthreadVideo
      src={staticFile('assets/pilot-v2.mp4')}
      style={{width: '100%', height: '100%', objectFit: 'cover'}}
    />
  </AbsoluteFill>
);

const AwesomeScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const cards = [
    ['assets/awesome-llm-apps/project-graveyard.png', 'PROJECT GRAVEYARD'],
    ['assets/awesome-llm-apps/insurance-claim.png', 'VOICE CLAIM TEAM'],
    ['assets/awesome-llm-apps/fraud-investigation.png', 'FRAUD INVESTIGATION'],
  ] as const;
  return (
    <AbsoluteFill style={{background: '#080A09', overflow: 'hidden'}}>
      <Grid color={C.acid} opacity={0.055} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 85% 22%, rgba(200,255,54,.15), transparent 35%), radial-gradient(circle at 10% 80%, rgba(77,199,255,.12), transparent 42%)',
        }}
      />
      <FrameChrome
        section="08 / PROTOTYPES"
        accent={C.acid}
        source="Shubhamsaboo/awesome-llm-apps"
      />
      <RankTag rank="#08" stars="+3,827" color={C.acid} />
      <BigTitle>
        上百个 Agent
        <br />
        和 RAG 应用案例。
      </BigTitle>
      <div style={{position: 'absolute', left: 38, right: 38, top: 500, height: 900}}>
        {cards.map(([src, label], index) => {
          const focus = phase(p, 0.08 + index * 0.19, 0.32 + index * 0.19);
          const exit = phase(p, 0.48 + index * 0.12, 0.76 + index * 0.1);
          const x = (index - 1) * 270 + map(focus, [0, 1], [180, 0]) - exit * 75;
          const y = index * 245 + (index % 2 ? 60 : 0) - focus * 30;
          return (
            <Window
              key={src}
              label={label}
              accent={index === 1 ? C.blue : C.acid}
              style={{
                position: 'absolute',
                left: 105 + x,
                top: y,
                width: 780,
                height: 455,
                transform: `rotate(${(index - 1) * 4 - focus * 1.5}deg) scale(${0.9 + focus * 0.08})`,
                opacity: 0.45 + focus * 0.55,
              }}
            >
              <Img
                src={staticFile(src)}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            </Window>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 1440,
          display: 'flex',
          gap: 12,
          opacity: phase(p, 0.68, 0.82),
        }}
      >
        {['100+ RUNNABLE', 'AGENT', 'RAG', 'CLONE & MODIFY'].map((label, index) => (
          <span
            key={label}
            style={{
              padding: '12px 14px',
              border: `1px solid ${index === 0 ? C.acid : '#56605B'}`,
              background: index === 0 ? C.acid : 'rgba(242,239,231,.055)',
              color: index === 0 ? C.ink : C.paper,
              fontFamily: uiFont,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1.2,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const CandleTape: React.FC<{frame: number}> = ({frame}) => (
  <div style={{position: 'absolute', inset: 0, opacity: 0.33}}>
    {Array.from({length: 28}).map((_, index) => {
      const x = 38 + index * 38;
      const base = 770 - ((index * 83 + frame * 2.2) % 320);
      const up = (index * 7) % 3 !== 0;
      return (
        <React.Fragment key={index}>
          <div
            style={{
              position: 'absolute',
              left: x + 7,
              top: base - 55,
              width: 2,
              height: 110,
              background: up ? C.acid : C.red,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: x,
              top: base - 24,
              width: 16,
              height: 48,
              background: up ? C.acid : C.red,
            }}
          />
        </React.Fragment>
      );
    })}
  </div>
);

const VibeTradingScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const videoStart = Math.round(segment.durationInFrames * 0.18);
  const videoDuration = Math.round(segment.durationInFrames * 0.54);
  return (
    <AbsoluteFill style={{background: '#060807', overflow: 'hidden'}}>
      <CandleTape frame={frame} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(6,8,7,.15), #060807 72%), radial-gradient(circle at 12% 20%, rgba(255,91,54,.18), transparent 35%)',
        }}
      />
      <FrameChrome
        section="07 / RESEARCH"
        accent={C.orange}
        source="HKUDS/Vibe-Trading"
      />
      <RankTag rank="#07" stars="+4,252" color={C.orange} />
      <BigTitle>把市场数据、分析和回测接进 Agent。</BigTitle>
      <Sequence from={videoStart} durationInFrames={videoDuration}>
        <Window
          label="VIBE TRADING · OFFICIAL WEB UI DEMO"
          accent={C.orange}
          style={{position: 'absolute', left: 42, right: 42, top: 465, height: 900}}
        >
          <OffthreadVideo
            src={staticFile('assets/vibe-trading/frontend.mp4')}
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </Window>
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: 1390,
          display: 'flex',
          gap: 14,
          opacity: phase(p, 0.58, 0.72),
        }}
      >
        {['DATA', 'ANALYSIS', 'BACKTEST'].map((label, index) => (
          <React.Fragment key={label}>
            <div
              style={{
                flex: 1,
                padding: '22px 16px',
                borderTop: `4px solid ${index === 2 ? C.orange : C.acid}`,
                background: 'rgba(242,239,231,.055)',
                fontFamily: uiFont,
                fontSize: 25,
                fontWeight: 850,
                color: index === 2 ? C.orange : C.paper,
              }}
            >
              {label}
            </div>
            {index < 2 ? (
              <div style={{alignSelf: 'center', fontSize: 28, color: C.dim}}>→</div>
            ) : null}
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          right: 50,
          top: 1220,
          padding: '17px 22px',
          border: `6px solid ${C.red}`,
          color: C.red,
          fontFamily: uiFont,
          fontSize: 34,
          fontWeight: 950,
          letterSpacing: 3,
          transform: `rotate(-8deg) scale(${0.7 + phase(p, 0.72, 0.82) * 0.3})`,
          opacity: phase(p, 0.72, 0.8),
        }}
      >
        RESEARCH ≠ RETURN
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const OmniRouteScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const line = phase(p, 0.08, 0.48);
  const health = phase(p, 0.62, 0.77);
  const nodes = [
    ['CODEX', 100, 500, C.acid],
    ['CURSOR', 100, 690, C.blue],
    ['CLAUDE', 100, 880, C.orange],
  ] as const;
  return (
    <AbsoluteFill style={{background: '#080B0C', overflow: 'hidden'}}>
      <Grid color={C.blue} opacity={0.065} />
      <FrameChrome
        section="06 / ROUTING"
        accent={C.blue}
        source="diegosouzapw/OmniRoute"
      />
      <RankTag rank="#06" stars="+4,297" color={C.blue} />
      <BigTitle>多个编码工具，共用一个模型网关。</BigTitle>
      <svg
        viewBox="0 0 1080 1000"
        style={{position: 'absolute', left: 0, top: 410, width: 1080, height: 1000}}
      >
        {nodes.map(([, x, y, color]) => (
          <path
            key={y}
            d={`M ${x + 160} ${y - 410} C 420 ${y - 410}, 420 320, 540 320`}
            fill="none"
            stroke={color}
            strokeWidth="5"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - line}
          />
        ))}
        {['OPENAI', 'ANTHROPIC', 'LOCAL'].map((label, index) => (
          <path
            key={label}
            d={`M 700 320 C 820 320, 820 ${180 + index * 180}, 920 ${180 + index * 180}`}
            fill="none"
            stroke={index === 1 && p > 0.5 ? C.red : C.dim}
            strokeWidth="4"
            strokeDasharray={index === 1 && p > 0.5 ? '15 13' : undefined}
            opacity={0.8}
          />
        ))}
      </svg>
      {nodes.map(([label, x, y, color]) => (
        <div
          key={label}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            width: 190,
            padding: '17px 0',
            textAlign: 'center',
            border: `1px solid ${color}`,
            background: '#101718',
            color,
            fontFamily: uiFont,
            fontSize: 22,
            fontWeight: 850,
          }}
        >
          {label}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 430,
          top: 660,
          width: 300,
          height: 190,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.blue,
          color: C.ink,
          fontFamily: uiFont,
          fontSize: 36,
          fontWeight: 950,
          transform: `scale(${0.82 + line * 0.18})`,
        }}
      >
        ONE GATEWAY
      </div>
      {['OPENAI', 'ANTHROPIC', 'LOCAL'].map((label, index) => (
        <div
          key={label}
          style={{
            position: 'absolute',
            right: 55,
            top: 500 + index * 180,
            width: 205,
            padding: '18px 0',
            textAlign: 'center',
            border: `1px solid ${index === 1 && p > 0.5 ? C.red : C.dim}`,
            color: index === 1 && p > 0.5 ? C.red : C.paper,
            background: '#101718',
            fontFamily: uiFont,
            fontSize: 21,
            fontWeight: 800,
            opacity: phase(p, 0.26 + index * 0.05, 0.43 + index * 0.05),
          }}
        >
          {label}
          {index === 1 && p > 0.5 ? <div style={{fontSize: 14}}>OFFLINE</div> : null}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 1110,
          height: 390,
          opacity: health,
          transform: `translateY(${(1 - health) * 70}px)`,
        }}
      >
        <Window label="PROVIDER HEALTH · OFFICIAL UI" accent={C.blue} style={{height: '100%'}}>
          <Img
            src={staticFile('assets/omniroute/health.png')}
            style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}}
          />
        </Window>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 1515,
          color: C.acid,
          fontFamily: uiFont,
          fontSize: 20,
          letterSpacing: 2,
          opacity: phase(p, 0.78, 0.9),
        }}
      >
        FAILOVER / CONTEXT COMPRESSION / ONE ENDPOINT
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const MidResetScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const strike = phase(p, 0.08, 0.32);
  const top5 = spring({
    frame: frame - Math.round(segment.durationInFrames * 0.58),
    fps: timeline.fps,
    config: {damping: 13, stiffness: 180},
  });
  return (
    <AbsoluteFill style={{background: C.acid, color: C.ink, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: -80,
          top: 150,
          fontFamily: uiFont,
          fontSize: 250,
          fontWeight: 950,
          opacity: 0.08,
          transform: `translateX(${-frame * 5}px)`,
          whiteSpace: 'nowrap',
        }}
      >
          TOP FIVE TOP FIVE TOP FIVE
      </div>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 470,
          fontFamily: uiFont,
          fontSize: 82,
          fontWeight: 950,
          lineHeight: 1.05,
        }}
      >
        进入
        <br />
        前五名
      </div>
      <div
        style={{
          position: 'absolute',
          left: 50,
          top: 555,
          width: 760 * strike,
          height: 18,
          background: C.red,
          transform: 'rotate(-6deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: 770,
          fontFamily: editorialFont,
          fontSize: 83,
          lineHeight: 1.08,
          fontWeight: 900,
          transform: `translateX(${(1 - phase(p, 0.28, 0.48)) * 100}px)`,
          opacity: phase(p, 0.28, 0.48),
        }}
      >
        <span style={{background: C.ink, color: C.acid, padding: '4px 15px'}}>本地数据</span>
        <br />
        并行开发 · 创作工具
      </div>
      <div
        style={{
          position: 'absolute',
          right: -25,
          bottom: 240,
          fontFamily: uiFont,
          fontSize: 260,
          lineHeight: 0.8,
          fontWeight: 950,
          letterSpacing: -18,
          transform: `rotate(-5deg) scale(${0.75 + top5 * 0.25})`,
          opacity: top5,
        }}
      >
        TOP
        <br />5
      </div>
      <Noise opacity={0.12} />
    </AbsoluteFill>
  );
};

const MeetilyScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const videoStart = Math.round(segment.durationInFrames * 0.12);
  const videoDuration = Math.round(segment.durationInFrames * 0.56);
  const summary = phase(p, 0.66, 0.8);
  return (
    <AbsoluteFill style={{background: '#080A0C', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 88% 16%, rgba(77,199,255,.16), transparent 35%), radial-gradient(circle at 5% 75%, rgba(200,255,54,.1), transparent 40%)',
        }}
      />
      <FrameChrome
        section="05 / PRIVACY"
        accent={C.blue}
        source="Zackriya-Solutions/meetily"
      />
      <RankTag rank="#05" stars="+4,389" color={C.blue} />
      <BigTitle>
        会议录音和摘要，
        <br />
        可以留在本地。
      </BigTitle>
      <Sequence from={videoStart} durationInFrames={videoDuration}>
        <Window
          label="MEETILY · OFFICIAL LOCAL TRANSCRIPTION DEMO"
          accent={C.blue}
          style={{position: 'absolute', left: 40, right: 40, top: 495, height: 900}}
        >
          <OffthreadVideo
            src={staticFile('assets/meetily/demo.mp4')}
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        </Window>
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 520,
          height: 760,
          opacity: summary,
          transform: `translateX(${(1 - summary) * 90}px)`,
        }}
      >
        <Window label="SUMMARY · OFFICIAL UI" accent={C.acid} style={{height: '100%'}}>
          <Img
            src={staticFile('assets/meetily/summary.png')}
            style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}}
          />
        </Window>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 1320,
          width: 420,
          padding: '28px 25px',
          background: C.acid,
          color: C.ink,
          fontFamily: uiFont,
          fontSize: 30,
          fontWeight: 950,
          opacity: phase(p, 0.72, 0.84),
        }}
      >
        LOCAL / SELF-HOSTED
      </div>
      <div
        style={{
          position: 'absolute',
          right: 60,
          top: 1320,
          width: 390,
          padding: '26px 25px',
          border: `3px solid ${C.blue}`,
          color: C.blue,
          fontFamily: uiFont,
          fontSize: 27,
          fontWeight: 900,
          opacity: phase(p, 0.78, 0.9),
        }}
      >
        CLOUD UPLOAD
        <span style={{float: 'right', color: C.red}}>OFF</span>
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const OrcaScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const videoStart = Math.round(segment.durationInFrames * 0.12);
  const videoDuration = Math.round(segment.durationInFrames * 0.54);
  const converge = phase(p, 0.66, 0.82);
  return (
    <AbsoluteFill style={{background: '#07090B', overflow: 'hidden'}}>
      <Grid color={C.orange} opacity={0.045} />
      <FrameChrome section="04 / WORKTREES" accent={C.orange} source="stablyai/orca" />
      <RankTag rank="#04" stars="+5,724" color={C.orange} />
      <BigTitle>
        多个 Agent 分开运行，
        <br />
        最后统一审阅。
      </BigTitle>
      <Sequence from={videoStart} durationInFrames={videoDuration}>
        <Window
          label="ORCA · PARALLEL WORKTREES"
          accent={C.orange}
          style={{position: 'absolute', left: 42, right: 42, top: 465, height: 880}}
        >
          <OffthreadVideo
            src={staticFile('assets/orca/worktrees.mp4')}
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(.78) contrast(1.14) saturate(.82)',
            }}
          />
        </Window>
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: 54,
          right: 54,
          top: 510,
          height: 760,
          opacity: converge,
          transform: `scale(${0.92 + converge * 0.08})`,
        }}
      >
        <Img
          src={staticFile('assets/orca/hero.jpg')}
          style={{width: '100%', height: '100%', objectFit: 'cover'}}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 0 0 2px rgba(255,91,54,.55), inset 0 -220px 160px rgba(0,0,0,.72)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 70,
          right: 70,
          top: 1320,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          opacity: phase(p, 0.73, 0.86),
        }}
      >
        {['WORKTREE A', 'WORKTREE B', 'WORKTREE C', 'ONE REVIEW'].map((label, index) => (
          <React.Fragment key={label}>
            <div
              style={{
                flex: 1,
                padding: '18px 10px',
                textAlign: 'center',
                background: index === 3 ? C.orange : 'rgba(242,239,231,.055)',
                border: `1px solid ${index === 3 ? C.orange : '#53605A'}`,
                color: index === 3 ? C.ink : C.paper,
                fontFamily: uiFont,
                fontSize: 18,
                fontWeight: 850,
              }}
            >
              {label}
            </div>
            {index < 3 ? <span style={{color: C.dim}}>→</span> : null}
          </React.Fragment>
        ))}
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const OfficeCliScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const cmd = phase(p, 0.04, 0.25);
  const gallery = phase(p, 0.28, 0.48);
  const wordStart = Math.round(segment.durationInFrames * 0.5);
  const wordDuration = Math.round(segment.durationInFrames * 0.42);
  return (
    <AbsoluteFill style={{background: '#090908', overflow: 'hidden'}}>
      <FrameChrome
        section="03 / DOCUMENTS"
        accent={C.yellow}
        source="iOfficeAI/OfficeCLI"
      />
      <RankTag rank="#03" stars="+7,129" color={C.yellow} />
      <BigTitle>用程序读写 Word、Excel 和 PowerPoint。</BigTitle>
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 490,
          height: 330,
          padding: '30px 35px',
          background: '#101310',
          border: '1px solid #46504A',
          fontFamily: 'Consolas, monospace',
          fontSize: 28,
          lineHeight: 1.8,
          color: '#A6B4AB',
          opacity: 1 - gallery,
        }}
      >
        {[
          '$ officecli create deck.pptx',
          '$ officecli write report.docx',
          '$ officecli update budget.xlsx',
          '$ officecli view deck.pptx --screenshot',
        ].map((line, index) => (
          <div
            key={line}
            style={{
              opacity: phase(cmd, index * 0.18, index * 0.18 + 0.34),
              color: index === 3 ? C.acid : '#A6B4AB',
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 52,
          right: 52,
          top: 470,
          height: 760,
          opacity: gallery,
          transform: `translateY(${(1 - gallery) * 80}px)`,
        }}
      >
        <Window label="OFFICECLI · POWERPOINT PROCESS" accent={C.yellow} style={{height: '100%'}}>
          <Img
            src={staticFile('assets/officecli/ppt-process.webp')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              imageRendering: 'auto',
            }}
          />
        </Window>
      </div>
      <Sequence from={wordStart} durationInFrames={wordDuration}>
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            top: 920,
            height: 510,
            display: 'flex',
            gap: 18,
          }}
        >
          <Window label="WORD" accent={C.blue} style={{flex: 1}}>
            <OffthreadVideo
              src={staticFile('assets/officecli/word.mp4')}
              muted
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          </Window>
          <Window label="EXCEL" accent={C.acid} style={{flex: 1}}>
            <Img
              src={staticFile('assets/officecli/excel.png')}
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          </Window>
        </div>
      </Sequence>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 1460,
          display: 'flex',
          gap: 14,
          opacity: phase(p, 0.72, 0.88),
        }}
      >
        {['DOCX', 'XLSX', 'PPTX', 'RENDER & CHECK'].map((label, index) => (
          <span
            key={label}
            style={{
              padding: '13px 17px',
              background: index === 3 ? C.yellow : 'rgba(242,239,231,.06)',
              color: index === 3 ? C.ink : C.paper,
              border: `1px solid ${index === 3 ? C.yellow : '#545C57'}`,
              fontFamily: uiFont,
              fontSize: 20,
              fontWeight: 850,
            }}
          >
            {label}
          </span>
        ))}
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const OpenCutScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const zoom = map(p, [0.08, 0.7], [1.08, 1.34]);
  const plan = phase(p, 0.58, 0.74);
  return (
    <AbsoluteFill style={{background: '#071018', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 80% 20%, rgba(77,199,255,.2), transparent 38%), linear-gradient(160deg, #071018, #080A09 70%)',
        }}
      />
      <FrameChrome
        section="02 / VIDEO"
        accent={C.blue}
        source="OpenCut-app/OpenCut · official beta UI"
      />
      <RankTag rank="#02" stars="+7,247" color={C.blue} />
      <BigTitle>网页、桌面和移动端的开源视频编辑器。</BigTitle>
      <div
        style={{
          position: 'absolute',
          left: 42,
          right: 42,
          top: 475,
          height: 870,
          overflow: 'hidden',
          border: `1px solid ${C.blue}88`,
          boxShadow: '0 35px 100px rgba(0,0,0,.65)',
        }}
      >
        <Img
          src={staticFile('assets/opencut/editor.png')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transform: `scale(${zoom}) translateY(${map(p, [0.08, 0.72], [0, -60])}px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            boxShadow: 'inset 0 -170px 120px rgba(0,0,0,.62)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: 1390,
          display: 'flex',
          gap: 12,
          opacity: plan,
        }}
      >
        {['WEB', 'DESKTOP', 'MOBILE'].map((label) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: '19px 10px',
              textAlign: 'center',
              background: 'rgba(77,199,255,.1)',
              borderTop: `4px solid ${C.blue}`,
              color: C.paper,
              fontFamily: uiFont,
              fontSize: 23,
              fontWeight: 850,
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 1505,
          color: C.orange,
          fontFamily: uiFont,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 1.4,
          opacity: phase(p, 0.72, 0.86),
        }}
      >
        ROADMAP / PLUGINS · SCRIPTING · HEADLESS · AGENT API
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const AiJobSearchScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const reveal = phase(p, 0.03, 0.2);
  const steps = [
    ['JOBS', '抓职位'],
    ['MATCH', '算匹配'],
    ['RESUME', '改简历'],
    ['INTERVIEW', '练面试'],
  ] as const;
  return (
    <AbsoluteFill style={{background: '#070A09', overflow: 'hidden'}}>
      <Grid color={C.acid} opacity={0.055} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 84% 13%, rgba(200,255,54,.18), transparent 36%), radial-gradient(circle at 10% 75%, rgba(255,91,54,.12), transparent 42%)',
        }}
      />
      <FrameChrome
        section="01 / WINNER"
        accent={C.acid}
        source="MadsLorentzen/ai-job-search · README workflow"
      />
      <RankTag rank="#01" stars="+13,195" color={C.acid} />
      <div
        style={{
          position: 'absolute',
          left: 55,
          top: 245,
          fontFamily: editorialFont,
          fontSize: 85,
          fontWeight: 900,
          lineHeight: 1.05,
          color: C.paper,
          opacity: reveal,
          transform: `translateY(${(1 - reveal) * 45}px)`,
        }}
      >
        AI JOB
        <br />
        SEARCH
      </div>
      <div
        style={{
          position: 'absolute',
          right: 50,
          top: 215,
          fontFamily: uiFont,
          textAlign: 'right',
        }}
      >
        <div style={{fontSize: 28, letterSpacing: 3, color: C.acid}}>7 DAYS</div>
        <div style={{fontSize: 112, fontWeight: 950, color: C.paper, letterSpacing: -5}}>
          +{Math.round(13195 * phase(p, 0.02, 0.35)).toLocaleString('en-US')}
        </div>
      </div>
      <Img
        src={staticFile('assets/ai-job-search/mascot.png')}
        style={{
          position: 'absolute',
          right: 70,
          top: 530 + Math.sin(frame / 12) * 16,
          width: 290,
          height: 290,
          objectFit: 'contain',
          filter: 'drop-shadow(0 20px 45px rgba(0,0,0,.5))',
          opacity: phase(p, 0.18, 0.32),
        }}
      />
      <div style={{position: 'absolute', left: 55, right: 55, top: 780, height: 610}}>
        {steps.map(([name, cn], index) => {
          const appear = phase(p, 0.17 + index * 0.12, 0.3 + index * 0.12);
          return (
            <React.Fragment key={name}>
              <div
                style={{
                  position: 'absolute',
                  left: index % 2 ? 515 : 0,
                  top: Math.floor(index / 2) * 250,
                  width: 440,
                  height: 180,
                  padding: '25px 27px',
                  borderTop: `5px solid ${index === 3 ? C.orange : C.acid}`,
                  background: 'rgba(242,239,231,.06)',
                  opacity: appear,
                  transform: `translateY(${(1 - appear) * 45}px)`,
                }}
              >
                <div
                  style={{
                    fontFamily: uiFont,
                    fontSize: 31,
                    fontWeight: 900,
                    color: index === 3 ? C.orange : C.acid,
                  }}
                >
                  {String(index + 1).padStart(2, '0')} / {name}
                </div>
                <div
                  style={{
                    marginTop: 20,
                    fontFamily: editorialFont,
                    fontSize: 35,
                    fontWeight: 800,
                    color: C.paper,
                  }}
                >
                  {cn}
                </div>
              </div>
              {index < 3 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: index === 0 ? 455 : index === 1 ? 730 : 455,
                    top: index === 2 ? 335 : 95,
                    color: C.dim,
                    fontSize: 42,
                    opacity: appear,
                    transform: index === 1 ? 'rotate(90deg)' : undefined,
                  }}
                >
                  →
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 58,
          top: 1430,
          padding: '18px 22px',
          border: `1px solid ${C.orange}`,
          color: C.orange,
          fontFamily: uiFont,
          fontSize: 19,
          fontWeight: 800,
          opacity: phase(p, 0.72, 0.86),
        }}
      >
        README FLOW VISUALIZATION · NOT A PRODUCT SCREENSHOT
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const OutroScene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const p = frame / segment.durationInFrames;
  const names = [
    'IMPECCABLE',
    'HERDR',
    'AWESOME LLM APPS',
    'VIBE TRADING',
    'OMNIROUTE',
    'MEETILY',
    'ORCA',
    'OFFICECLI',
    'OPENCUT',
    'AI JOB SEARCH',
  ];
  return (
    <AbsoluteFill style={{background: C.ink, overflow: 'hidden'}}>
      <Grid color={C.acid} opacity={0.055} />
      <FrameChrome section="OUTRO / NEXT TEST" accent={C.acid} />
      <div
        style={{
          position: 'absolute',
          left: 55,
          top: 180,
          fontFamily: uiFont,
          fontSize: 29,
          letterSpacing: 3,
          color: C.dim,
        }}
      >
          THIS WEEK / TEN PROJECTS
      </div>
      <div
        style={{
          position: 'absolute',
          left: 52,
          right: 52,
          top: 240,
          fontFamily: editorialFont,
          fontSize: 103,
          fontWeight: 900,
          lineHeight: 1,
          color: C.paper,
          letterSpacing: -5,
        }}
      >
        10 PROJECTS
        <br />
        <span style={{color: C.acid}}>
          {Math.round(timeline.durationInFrames / timeline.fps)} SECONDS.
        </span>
      </div>
      <div style={{position: 'absolute', left: 62, right: 62, top: 550, height: 600}}>
        {names.map((name, index) => {
          const appear = phase(p, 0.12 + index * 0.035, 0.28 + index * 0.035);
          return (
            <div
              key={name}
              style={{
                position: 'absolute',
                left: index % 2 ? 480 : 0,
                top: Math.floor(index / 2) * 102,
                width: 440,
                height: 75,
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid rgba(242,239,231,.18)',
                fontFamily: uiFont,
                fontSize: 21,
                color: index >= 7 ? C.acid : C.paper,
                opacity: appear,
                transform: `translateX(${(1 - appear) * (index % 2 ? 75 : -75)}px)`,
              }}
            >
              <span style={{color: C.dim, width: 55}}>
                {String(10 - index).padStart(2, '0')}
              </span>
              {name}
              <span style={{marginLeft: 'auto', color: C.dim}}>→</span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 55,
          right: 55,
          top: 1230,
          padding: '34px 35px',
          background: C.acid,
          color: C.ink,
          fontFamily: uiFont,
          opacity: phase(p, 0.56, 0.72),
          transform: `translateY(${(1 - phase(p, 0.56, 0.72)) * 55}px)`,
        }}
      >
        <div style={{fontSize: 24, letterSpacing: 3, fontWeight: 800}}>
          NEXT WEEK / REAL TEST
        </div>
        <div style={{fontFamily: editorialFont, fontSize: 54, fontWeight: 900, marginTop: 14}}>
          下周完整测试一个项目。
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 55,
          top: 1485,
          fontFamily: editorialFont,
          fontSize: 54,
          color: C.paper,
          fontWeight: 850,
          opacity: phase(p, 0.72, 0.86),
        }}
      >
        你想先测哪个？
      </div>
      <Noise />
    </AbsoluteFill>
  );
};

const sceneRegistry: Record<
  string,
  React.FC<{segment: FullSegment}>
> = {
  pilot_clip: PilotClipScene,
  awesome_llm_apps: AwesomeScene,
  vibe_trading: VibeTradingScene,
  omniroute: OmniRouteScene,
  mid_reset: MidResetScene,
  meetily: MeetilyScene,
  orca: OrcaScene,
  officecli: OfficeCliScene,
  opencut: OpenCutScene,
  ai_job_search: AiJobSearchScene,
  outro: OutroScene,
};

const Scene: React.FC<{segment: FullSegment}> = ({segment}) => {
  const Component = sceneRegistry[segment.id];
  if (!Component) {
    throw new Error(`No V2 full scene registered for "${segment.id}"`);
  }
  return (
    <>
      <Component segment={segment} />
      <CaptionTrack segment={segment} />
    </>
  );
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
        <Audio src={staticFile('audio/full-bed.wav')} volume={0.13} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const fullDurationInFrames = timeline.durationInFrames;
