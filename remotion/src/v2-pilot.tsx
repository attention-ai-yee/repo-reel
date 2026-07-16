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
  useVideoConfig,
} from 'remotion';
import timeline from './generated/pilot-timeline.json';

const C = {
  ink: '#070A09',
  paper: '#F2EFE7',
  acid: '#C8FF36',
  orange: '#FF5B36',
  blue: '#4DC7FF',
  dim: '#8D968F',
};

type TimelineSegment = (typeof timeline.segments)[number];

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const enter = (frame: number, delay = 0, duration = 18) =>
  interpolate(frame, [delay, delay + duration], [0, 1], clamp);

const editorialFont = '"Noto Serif SC", "Noto Sans SC", serif';
const uiFont = '"Bahnschrift", "Noto Sans SC", sans-serif';

const Noise: React.FC = () => (
  <AbsoluteFill
    style={{
      opacity: 0.1,
      mixBlendMode: 'screen',
      backgroundImage:
        'repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,.5) 0 0.65px, transparent .75px 3px)',
      backgroundSize: '5px 5px',
      pointerEvents: 'none',
    }}
  />
);

const FrameChrome: React.FC<{section: string; accent?: string}> = ({section, accent = C.acid}) => (
  <>
    <div
      style={{
        position: 'absolute',
        left: 54,
        top: 50,
        fontFamily: uiFont,
        fontWeight: 700,
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
        top: 50,
        padding: '8px 12px',
        border: `1px solid ${accent}`,
        fontFamily: uiFont,
        fontSize: 18,
        color: accent,
        letterSpacing: 2,
      }}
    >
      {section}
    </div>
    <div style={{position: 'absolute', left: 54, right: 54, top: 99, height: 1, background: 'rgba(242,239,231,.22)'}} />
  </>
);

const highlightParts = (text: string) => {
  const tokens = text.split(/(GitHub|Star|AI|Impeccable|Herder|Agent|第十名)/gi);
  return tokens.map((token, index) => {
    const hot = /^(GitHub|Star|AI|Impeccable|Herder|Agent|第十名)$/i.test(token);
    return (
      <span key={`${token}-${index}`} style={{color: hot ? C.acid : C.paper}}>
        {token}
      </span>
    );
  });
};

const splitPhrases = (text: string) => {
  const marked = text
    .replace(/([。！？；])/g, '$1|')
    .replace(/([，：])/g, '$1|')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const output: string[] = [];
  let pending = '';
  for (const part of marked) {
    if (pending && pending.length + part.length > 18) {
      output.push(pending);
      pending = part;
    } else {
      pending += part;
    }
  }
  if (pending) output.push(pending);
  return output;
};

const Captions: React.FC<{segment: TimelineSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  if (!('spoken' in segment) || !segment.spoken) return null;
  const phrases = splitPhrases(segment.spoken);
  const audioFrames = Math.max(1, Math.round(('audioSeconds' in segment ? segment.audioSeconds : 0) * timeline.fps));
  const totalWeight = phrases.reduce((sum, phrase) => sum + phrase.length, 0);
  let cursor = 0;
  let active = phrases[phrases.length - 1];
  let activeStart = 0;
  let activeEnd = audioFrames;
  for (const phrase of phrases) {
    const span = Math.max(18, Math.round((audioFrames * phrase.length) / totalWeight));
    if (frame >= cursor && frame < cursor + span) {
      active = phrase;
      activeStart = cursor;
      activeEnd = cursor + span;
      break;
    }
    cursor += span;
  }
  const opacity = interpolate(frame, [activeStart, activeStart + 4, activeEnd - 4, activeEnd], [0, 1, 1, 0], clamp);
  const y = interpolate(frame, [activeStart, activeStart + 7], [18, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        left: 75,
        right: 75,
        bottom: 112,
        opacity,
        transform: `translateY(${y}px)`,
        textAlign: 'center',
        fontFamily: '"Noto Sans SC", sans-serif',
        fontWeight: 850,
        fontSize: 48,
        lineHeight: 1.35,
        letterSpacing: -1.2,
        textShadow: '0 3px 0 #070A09, 3px 0 0 #070A09, -3px 0 0 #070A09, 0 -3px 0 #070A09, 0 8px 26px rgba(0,0,0,.85)',
      }}
    >
      {highlightParts(active)}
    </div>
  );
};

const TerminalRain: React.FC<{frame: number}> = ({frame}) => {
  const lines = [
    '$ gh trending --since weekly',
    'fetching 22 repositories...',
    'stars.delta = current - previous',
    'rank.sort(by: "velocity")',
    '01  ai-job-search      +13,195',
    '02  OpenCut             +7,247',
    '03  OfficeCLI           +7,129',
    'signal detected ████████████',
  ];
  return (
    <div style={{position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.42}}>
      {Array.from({length: 3}).map((_, column) => (
        <div
          key={column}
          style={{
            position: 'absolute',
            left: 70 + column * 335,
            top: -80 + ((frame * (0.7 + column * 0.16)) % 220),
            width: 300,
            fontFamily: uiFont,
            fontSize: 18,
            color: column === 1 ? C.acid : '#718078',
            lineHeight: 2.4,
            whiteSpace: 'nowrap',
          }}
        >
          {[...lines, ...lines, ...lines].map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      ))}
    </div>
  );
};

const HookScene: React.FC<{segment: TimelineSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const count = Math.round(interpolate(frame, [8, fps * 3.8], [0, 13195], clamp));
  const titleIn = spring({frame: frame - 86, fps, config: {damping: 18, stiffness: 150, mass: 0.8}});
  const jobIn = enter(frame, 145, 20);
  const pathLength = interpolate(frame, [10, 115], [0, 1], clamp);
  return (
    <AbsoluteFill style={{background: C.ink, color: C.paper, overflow: 'hidden'}}>
      <TerminalRain frame={frame} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(77,199,255,.18), transparent 38%), linear-gradient(180deg, transparent 55%, rgba(0,0,0,.72))'}} />
      <FrameChrome section="00 / HOOK" />
      <div style={{position: 'absolute', left: 62, top: 180, fontFamily: uiFont, fontSize: 23, letterSpacing: 3, color: C.dim}}>THE FASTEST LINE THIS WEEK</div>
      <div style={{position: 'absolute', left: 56, top: 245, right: 56, height: 440}}>
        <svg viewBox="0 0 968 430" width="100%" height="100%">
          <path d="M20 380 C155 366, 190 348, 278 352 S420 310, 506 305 S620 252, 696 244 S792 168, 844 154 S912 76, 950 30" fill="none" stroke="rgba(242,239,231,.12)" strokeWidth="22" />
          <path
            d="M20 380 C155 366, 190 348, 278 352 S420 310, 506 305 S620 252, 696 244 S792 168, 844 154 S912 76, 950 30"
            fill="none"
            stroke={C.acid}
            strokeWidth="10"
            strokeLinecap="square"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - pathLength}
            style={{filter: `drop-shadow(0 0 18px ${C.acid})`}}
          />
        </svg>
      </div>
      <div style={{position: 'absolute', right: 65, top: 250, fontFamily: uiFont, textAlign: 'right'}}>
        <div style={{fontSize: 26, letterSpacing: 4, color: C.acid}}>7 DAYS</div>
        <div style={{fontSize: 126, fontWeight: 800, letterSpacing: -5}}>+{count.toLocaleString('en-US')}</div>
        <div style={{fontSize: 26, color: C.dim, letterSpacing: 2}}>STARS / VELOCITY</div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 56,
          right: 56,
          top: 735,
          transform: `translateY(${(1 - titleIn) * 55}px)`,
          opacity: titleIn,
        }}
      >
        <div style={{fontFamily: editorialFont, fontSize: 91, fontWeight: 850, lineHeight: 1.12, letterSpacing: -5}}>
          一套 AI 求职流程，<br />七天涨一万三千 Star。
        </div>
      </div>
      <div style={{position: 'absolute', left: 54, right: 54, top: 1030, height: 460, opacity: jobIn, transform: `translateX(${(1 - jobIn) * 120}px) rotate(-2deg)`}}>
        {[
          ['AI ENGINEER', '92% MATCH', C.acid],
          ['PRODUCT BUILDER', '87% MATCH', C.blue],
          ['ML PLATFORM', '81% MATCH', C.orange],
        ].map(([role, match, accent], index) => (
          <div
            key={role}
            style={{
              position: 'absolute',
              top: index * 98,
              left: index * 52,
              right: 100 - index * 25,
              height: 120,
              border: '1px solid rgba(242,239,231,.28)',
              background: 'rgba(13,17,15,.92)',
              boxShadow: '0 18px 50px rgba(0,0,0,.38)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 28px',
              fontFamily: uiFont,
            }}
          >
            <div style={{width: 12, height: 70, background: accent}} />
            <div style={{marginLeft: 22, fontSize: 27, letterSpacing: 1.8}}>{role}</div>
            <div style={{marginLeft: 'auto', color: accent, fontSize: 24}}>{match}</div>
          </div>
        ))}
      </div>
      <Captions segment={segment} />
      <Noise />
    </AbsoluteFill>
  );
};

const ScopeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 12], [130, 0], clamp);
  return (
    <AbsoluteFill style={{background: C.acid, color: C.ink, justifyContent: 'center', padding: 62, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: -50, top: 170, fontFamily: uiFont, fontSize: 300, fontWeight: 900, opacity: 0.09, transform: `translateX(${-frame * 7}px)`}}>WEEKLY WEEKLY</div>
      <div style={{transform: `translateX(${x}px)`, fontFamily: uiFont}}>
        <div style={{fontSize: 28, letterSpacing: 5, fontWeight: 700}}>DATA NOTE / 02 SEC</div>
        <div style={{fontSize: 86, lineHeight: 1.03, fontWeight: 850, marginTop: 34, letterSpacing: -3}}>GitHub Trending</div>
        <div style={{display: 'flex', alignItems: 'center', gap: 20, marginTop: 35, fontSize: 34, fontWeight: 700}}>
          <span style={{background: C.ink, color: C.acid, padding: '13px 18px'}}>THIS WEEK</span>
          <span>22 个项目重排</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 62, bottom: 96, fontFamily: '"Noto Sans SC"', fontSize: 22, fontWeight: 650}}>候选池内按 stars this week 重新排序 · 非全站完整增量榜</div>
      <Noise />
    </AbsoluteFill>
  );
};

const BrowserWindow: React.FC<{src: string; label: string; style?: React.CSSProperties}> = ({src, label, style}) => (
  <div
    style={{
      overflow: 'hidden',
      border: '1px solid rgba(242,239,231,.28)',
      background: '#111413',
      boxShadow: '0 30px 90px rgba(0,0,0,.55)',
      ...style,
    }}
  >
    <div style={{height: 48, display: 'flex', alignItems: 'center', gap: 9, padding: '0 18px', borderBottom: '1px solid rgba(242,239,231,.14)', fontFamily: uiFont, color: C.dim, fontSize: 16}}>
      <i style={{width: 10, height: 10, borderRadius: '50%', background: '#FF5B4D'}} />
      <i style={{width: 10, height: 10, borderRadius: '50%', background: '#FFC145'}} />
      <i style={{width: 10, height: 10, borderRadius: '50%', background: '#55D98A'}} />
      <span style={{marginLeft: 12}}>{label}</span>
    </div>
    <Img src={staticFile(src)} style={{width: '100%', height: 'calc(100% - 48px)', objectFit: 'cover', objectPosition: 'top'}} />
  </div>
);

const RankIntro: React.FC<{rank: string; stars: string; color: string}> = ({rank, stars, color}) => {
  const frame = useCurrentFrame();
  const scale = spring({frame, fps: timeline.fps, config: {damping: 16, stiffness: 190}});
  return (
    <div style={{position: 'absolute', left: 56, top: 148, display: 'flex', alignItems: 'center', gap: 20, transform: `scale(${0.82 + scale * 0.18})`, transformOrigin: 'left center'}}>
      <div style={{background: color, color: C.ink, fontFamily: uiFont, fontSize: 39, fontWeight: 900, padding: '12px 17px'}}>{rank}</div>
      <div style={{fontFamily: uiFont, color, fontWeight: 800, fontSize: 26, letterSpacing: 2.2}}>{stars} / THIS WEEK</div>
    </div>
  );
};

const ImpeccableScene: React.FC<{segment: TimelineSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wipe = interpolate(frame, [68, 170], [0, 100], clamp);
  const browserScale = interpolate(frame, [20, 160, 270], [0.92, 1.04, 0.88], clamp);
  const metricIn = spring({frame: frame - 235, fps, config: {damping: 16, stiffness: 170}});
  const wordList = ['polish', 'critique', 'animate', 'bolder', 'distill'];
  return (
    <AbsoluteFill style={{background: '#0A0B0A', color: C.paper, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 10% 10%, rgba(255,91,54,.13), transparent 38%), radial-gradient(circle at 90% 55%, rgba(200,255,54,.11), transparent 42%)'}} />
      <FrameChrome section="10 / DESIGN" accent={C.orange} />
      <RankIntro rank="#10" stars="+2,494" color={C.orange} />
      <div style={{position: 'absolute', left: 56, top: 245, right: 56}}>
        <div style={{fontFamily: editorialFont, fontSize: 70, fontWeight: 850, lineHeight: 1.13, letterSpacing: -3}}>给编码 Agent<br />加入一套设计规则。</div>
      </div>
      <div style={{position: 'absolute', left: 55, right: 55, top: 470, height: 790, transform: `scale(${browserScale})`, transformOrigin: 'center top'}}>
        <BrowserWindow src="assets/impeccable/dashboard-before.webp" label="BEFORE · generic dashboard" style={{position: 'absolute', inset: 0}} />
        <div style={{position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - wipe}% 0 0)`}}>
          <BrowserWindow src="assets/impeccable/dashboard-after.webp" label="AFTER · guided design" style={{position: 'absolute', inset: 0, borderColor: C.acid}} />
        </div>
        <div style={{position: 'absolute', left: `${wipe}%`, top: -18, bottom: -18, width: 4, background: C.acid, boxShadow: `0 0 28px ${C.acid}`}} />
        <div style={{position: 'absolute', left: 18, bottom: 18, fontFamily: uiFont, padding: '8px 12px', background: C.orange, color: C.ink, fontWeight: 800}}>BEFORE</div>
        <div style={{position: 'absolute', right: 18, bottom: 18, fontFamily: uiFont, padding: '8px 12px', background: C.acid, color: C.ink, fontWeight: 800}}>AFTER</div>
      </div>
      <div style={{position: 'absolute', left: 56, right: 56, top: 1295, height: 285, display: 'flex', gap: 18, opacity: metricIn, transform: `translateY(${(1 - metricIn) * 50}px)`}}>
        {[['23', 'DESIGN COMMANDS'], ['46', 'DETECTOR RULES']].map(([number, label], index) => (
          <div key={label} style={{flex: 1, borderTop: `5px solid ${index ? C.acid : C.orange}`, background: 'rgba(242,239,231,.055)', padding: '24px 26px'}}>
            <div style={{fontFamily: uiFont, fontSize: 79, fontWeight: 900, color: index ? C.acid : C.orange}}>{number}</div>
            <div style={{fontFamily: uiFont, fontSize: 21, letterSpacing: 2.2, color: C.dim}}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', right: 55, top: 1598, display: 'flex', gap: 10, opacity: enter(frame, 285, 18)}}>
        {wordList.map((word, index) => (
          <span key={word} style={{fontFamily: uiFont, fontSize: 17, padding: '7px 10px', border: '1px solid rgba(242,239,231,.22)', color: index % 2 ? C.dim : C.paper}}>/ {word}</span>
        ))}
      </div>
      <Captions segment={segment} />
      <Noise />
    </AbsoluteFill>
  );
};

const FakeTerminal: React.FC<{x: number; y: number; rotate: number; delay: number; frame: number}> = ({x, y, rotate, delay, frame}) => {
  const opacity = enter(frame, delay, 12);
  const lines = ['agent-01  working...', 'agent-02  blocked', 'agent-03  done ✓', '$ git diff --stat'];
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 620, height: 260, transform: `translateY(${(1 - opacity) * 90}px) rotate(${rotate}deg)`, opacity, background: '#101512', border: '1px solid #34413A', boxShadow: '0 25px 70px rgba(0,0,0,.5)', padding: 25, fontFamily: 'Consolas, monospace', color: '#A5B2AA', fontSize: 23, lineHeight: 1.8}}>
      {lines.map((line, index) => <div key={line} style={{color: index === 1 ? C.orange : index === 2 ? C.acid : '#A5B2AA'}}>{line}</div>)}
    </div>
  );
};

const HerdrScene: React.FC<{segment: TimelineSegment}> = ({segment}) => {
  const frame = useCurrentFrame();
  const videoIn = enter(frame, 105, 22);
  const statusIn = enter(frame, 212, 18);
  return (
    <AbsoluteFill style={{background: '#070B0B', color: C.paper, overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 90% 13%, rgba(77,199,255,.17), transparent 38%), radial-gradient(circle at 0% 70%, rgba(200,255,54,.10), transparent 42%)'}} />
      <FrameChrome section="09 / TERMINAL" accent={C.blue} />
      <RankIntro rank="#09" stars="+3,115" color={C.blue} />
      <div style={{position: 'absolute', left: 56, right: 56, top: 250}}>
        <div style={{fontFamily: editorialFont, fontSize: 70, fontWeight: 850, lineHeight: 1.13, letterSpacing: -3}}>多个编码 Agent，<br />集中放进终端界面。</div>
      </div>
      <div style={{position: 'absolute', inset: 0, opacity: 1 - videoIn}}>
        <FakeTerminal x={80} y={555} rotate={-4} delay={5} frame={frame} />
        <FakeTerminal x={355} y={770} rotate={3} delay={20} frame={frame} />
        <FakeTerminal x={38} y={1000} rotate={-1.5} delay={35} frame={frame} />
      </div>
      <div style={{position: 'absolute', left: 44, right: 44, top: 520, height: 920, opacity: videoIn, transform: `translateY(${(1 - videoIn) * 90}px) scale(${0.96 + videoIn * 0.04})`, border: `1px solid rgba(77,199,255,.48)`, background: '#0D1110', boxShadow: '0 35px 100px rgba(0,0,0,.65)', overflow: 'hidden'}}>
        <div style={{height: 55, borderBottom: '1px solid rgba(242,239,231,.15)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', fontFamily: uiFont, fontSize: 17, color: C.dim}}>
          <i style={{width: 11, height: 11, borderRadius: '50%', background: C.orange}} />
          <i style={{width: 11, height: 11, borderRadius: '50%', background: '#FFC145'}} />
          <i style={{width: 11, height: 11, borderRadius: '50%', background: C.acid}} />
          <span style={{marginLeft: 14}}>herdr · real terminal multiplexer</span>
        </div>
        <OffthreadVideo
          src={staticFile('assets/herdr/demo.mp4')}
          muted
          style={{width: '100%', height: 'calc(100% - 55px)', objectFit: 'cover', objectPosition: 'center top'}}
        />
      </div>
      <div style={{position: 'absolute', left: 70, right: 70, top: 1480, display: 'flex', gap: 12, opacity: statusIn, transform: `translateY(${(1 - statusIn) * 30}px)`}}>
        {[
          ['WORKING', C.blue],
          ['BLOCKED', C.orange],
          ['DONE', C.acid],
        ].map(([label, color]) => (
          <div key={label} style={{flex: 1, borderTop: `4px solid ${color}`, background: 'rgba(242,239,231,.06)', padding: '20px 17px', fontFamily: uiFont, fontSize: 24, fontWeight: 800, color}}>{label}</div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 70, top: 1600, fontFamily: uiFont, fontSize: 20, letterSpacing: 2, color: C.dim, opacity: enter(frame, 260, 18)}}>DETACH · REATTACH · SSH · SOCKET API</div>
      <Captions segment={segment} />
      <Noise />
    </AbsoluteFill>
  );
};

const Scene: React.FC<{segment: TimelineSegment}> = ({segment}) => {
  if (segment.id === 'hook') return <HookScene segment={segment} />;
  if (segment.id === 'scope') return <ScopeScene />;
  if (segment.id === 'impeccable') return <ImpeccableScene segment={segment} />;
  return <HerdrScene segment={segment} />;
};

export const GitHubWeeklyV2Pilot: React.FC = () => {
  return (
    <AbsoluteFill style={{background: C.ink}}>
      {timeline.segments.map((segment) => (
        <Sequence key={segment.id} from={segment.startFrame} durationInFrames={segment.durationInFrames} premountFor={30}>
          <Scene segment={segment} />
          {'audio' in segment && segment.audio ? <Audio src={staticFile(segment.audio)} volume={1} /> : null}
        </Sequence>
      ))}
      <Audio src={staticFile('audio/pilot-bed.wav')} volume={0.14} loop={false} />
    </AbsoluteFill>
  );
};
