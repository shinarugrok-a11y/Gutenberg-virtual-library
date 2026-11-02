import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useDesk, type LcdId, type SkinId } from "@/lib/desk-store";

type Track = { id: string; name: string; url: string };

const SKINS: { id: SkinId; label: string }[] = [
  { id: "amber", label: "Amber" },
  { id: "classic", label: "Classic" },
  { id: "paper", label: "Paper" },
  { id: "nocturne", label: "Nocturne" },
  { id: "phosphor", label: "Phosphor" },
];

const LCDS: { id: LcdId; label: string }[] = [
  { id: "amber", label: "Amber" },
  { id: "green", label: "Green" },
  { id: "ice", label: "Ice" },
  { id: "paper", label: "Paper" },
];

const BANDS = [
  { label: "60", type: "lowshelf" as BiquadFilterType, freq: 60 },
  { label: "250", type: "peaking" as BiquadFilterType, freq: 250 },
  { label: "1k", type: "peaking" as BiquadFilterType, freq: 1000 },
  { label: "4k", type: "peaking" as BiquadFilterType, freq: 4000 },
  { label: "12k", type: "highshelf" as BiquadFilterType, freq: 12000 },
];

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

export function Winamp({ onAir, motion }: { onAir: boolean; motion: boolean }) {
  const skin = useDesk((s) => s.skin);
  const lcd = useDesk((s) => s.lcd);
  const showPlaylist = useDesk((s) => s.showPlaylist);
  const showEq = useDesk((s) => s.showEq);
  const volume = useDesk((s) => s.volume);
  const eq = useDesk((s) => s.eq);
  const setSkin = useDesk((s) => s.setSkin);
  const setLcd = useDesk((s) => s.setLcd);
  const setShowPlaylist = useDesk((s) => s.setShowPlaylist);
  const setShowEq = useDesk((s) => s.setShowEq);
  const setVolume = useDesk((s) => s.setVolume);
  const setEqBand = useDesk((s) => s.setEqBand);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [balance, setBalance] = useState(0);
  const [dressing, setDressing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const tracksRef = useRef(tracks);
  const indexRef = useRef(index);
  tracksRef.current = tracks;
  indexRef.current = index;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audio);
    const filters = BANDS.map((band) => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.freq;
      filter.Q.value = 0.9;
      return filter;
    });
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    let node: AudioNode = source;
    for (const filter of filters) {
      node.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(panner);
    panner.connect(analyser);
    analyser.connect(ctx.destination);
    audioRef.current = audio;
    gainRef.current = gain;
    pannerRef.current = panner;
    filtersRef.current = filters;
    analyserRef.current = analyser;
    ctxRef.current = ctx;
    const onTime = () => setTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audioRef.current = audio;
    gainRef.current = gain;
    pannerRef.current = panner;
    filtersRef.current = filters;
    analyserRef.current = analyser;
    ctxRef.current = ctx;
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      void ctx.close();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => {
      const list = tracksRef.current;
      const at = indexRef.current;
      if (!list.length) return;
      if (repeat === "one") {
        audio.currentTime = 0;
        void audio.play();
        return;
      }
      let next = shuffle && list.length > 1 ? Math.floor(Math.random() * list.length) : at + 1;
      if (shuffle && next === at) next = (next + 1) % list.length;
      if (next >= list.length) {
        if (repeat === "all") next = 0;
        else {
          setPlaying(false);
          return;
        }
      }
      setIndex(next);
      audio.src = list[next]!.url;
      void audio.play();
    };
    audio.onended = onEnd;
  }, [repeat, shuffle]);

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume * (onAir ? 0.28 : 1);
  }, [volume, onAir]);

  useEffect(() => {
    if (pannerRef.current) pannerRef.current.pan.value = balance;
  }, [balance]);

  useEffect(() => {
    filtersRef.current.forEach((filter, i) => {
      filter.gain.value = eq[i] ?? 0;
    });
  }, [eq]);

  useEffect(() => {
    const wrap = barsRef.current;
    const analyser = analyserRef.current;
    if (!wrap || !analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const bars = wrap.children;
    const draw = () => {
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / bars.length));
      for (let i = 0; i < bars.length; i++) {
        const value = motion && playing ? (data[i * step] ?? 0) / 255 : 0.08;
        (bars[i] as HTMLElement).style.height = `${Math.max(8, value * 100)}%`;
      }
      if (motion && playing) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [motion, playing, skin, lcd]);

  function loadFiles(list: FileList | null) {
    if (!list?.length) return;
    const next = [...tracks];
    for (const file of list) {
      if (!file.type.startsWith("audio/")) continue;
      next.push({ id: `${file.name}-${file.size}-${next.length}`, name: file.name.replace(/\.[^.]+$/, ""), url: URL.createObjectURL(file) });
    }
    setTracks(next);
    if (!audioRef.current?.src && next[0]) {
      audioRef.current!.src = next[0].url;
      setIndex(0);
    }
  }

  async function toggle() {
    const audio = audioRef.current;
    const ctx = ctxRef.current;
    if (!audio || !tracks.length) return;
    await ctx?.resume();
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (!audio.src) audio.src = tracks[index]?.url ?? tracks[0]!.url;
    await audio.play();
    setPlaying(true);
  }

  function go(next: number) {
    const audio = audioRef.current;
    if (!audio || !tracks.length) return;
    const at = (next + tracks.length) % tracks.length;
    setIndex(at);
    audio.src = tracks[at]!.url;
    if (playing) void audio.play();
  }

  const track = tracks[index];

  return (
    <section className="player" data-skin={skin} data-lcd={lcd}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="eyebrow" style={{ color: "var(--p-lcd-fg)" }}>
          Headphones
        </p>
        <button type="button" className="transport" onClick={() => setDressing((value) => !value)} aria-expanded={dressing}>
          Skin
        </button>
      </div>
      <div className="lcd">
        <p className="m-0 text-xs tracking-widest uppercase">{track ? "Plugged in" : "Jack empty"}</p>
        <p className="lcd-title">{track ? track.name : "Plug in your own music"}</p>
        <p className="m-0 text-sm">
          {clock(time)} / {clock(duration)}
        </p>
        <div ref={barsRef} className="viz" aria-hidden>
          {Array.from({ length: 24 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      </div>
      <input
        className="range mt-2"
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(time, duration || 0)}
        aria-label="Seek"
        onChange={(event) => {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = Number(event.target.value);
          setTime(audio.currentTime);
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-1">
        <button type="button" className={`transport${shuffle ? " is-on" : ""}`} aria-pressed={shuffle} aria-label="Shuffle" onClick={() => setShuffle((value) => !value)}>
          <Shuffle className="size-4" />
        </button>
        <button type="button" className="transport" aria-label="Previous" onClick={() => go(index - 1)}>
          <SkipBack className="size-4" />
        </button>
        <button type="button" className="transport" aria-label={playing ? "Pause" : "Play"} onClick={() => void toggle()}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button type="button" className="transport" aria-label="Next" onClick={() => go(index + 1)}>
          <SkipForward className="size-4" />
        </button>
        <button
          type="button"
          className={`transport${repeat !== "off" ? " is-on" : ""}`}
          aria-label="Repeat"
          onClick={() => setRepeat((value) => (value === "off" ? "all" : value === "all" ? "one" : "off"))}
        >
          {repeat === "one" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
        </button>
      </div>
      <label className="mt-2 block text-xs" style={{ color: "var(--p-muted)" }}>
        Volume
        <input className="range" type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
      </label>
      <label className="mt-1 block text-xs" style={{ color: "var(--p-muted)" }}>
        Balance
        <input className="range" type="range" min={-1} max={1} step={0.01} value={balance} onChange={(event) => setBalance(Number(event.target.value))} />
      </label>
      <label className="desk-btn mt-3 flex cursor-pointer items-center justify-center gap-2">
        <Headphones className="size-4" aria-hidden />
        Plug in records
        <input className="sr-only" type="file" accept="audio/*" multiple onChange={(event) => loadFiles(event.target.files)} />
      </label>
      <p className="mt-2 text-xs" style={{ color: "var(--p-muted)" }}>
        Your files stay in this browser. They are not uploaded. On air, the book ducks the music.
      </p>
      {showPlaylist && (
        <div className="playlist mt-2">
          {tracks.map((item, i) => (
            <button key={item.id} type="button" className={i === index ? "is-on" : ""} onClick={() => go(i)}>
              {i + 1}. {item.name}
            </button>
          ))}
          {!tracks.length && <p className="text-xs" style={{ color: "var(--p-muted)" }}>No records yet.</p>}
        </div>
      )}
      {showEq && (
        <div className="eq mt-3">
          {BANDS.map((band, i) => (
            <label key={band.label}>
              <input type="range" min={-12} max={12} step={1} value={eq[i] ?? 0} aria-label={`${band.label} hertz`} onChange={(event) => setEqBand(i, Number(event.target.value))} />
              {band.label}
            </label>
          ))}
        </div>
      )}
      {dressing && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="row-scroll">
            {SKINS.map((item) => (
              <button key={item.id} type="button" className={`transport${skin === item.id ? " is-on" : ""}`} onClick={() => setSkin(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="row-scroll">
            {LCDS.map((item) => (
              <button key={item.id} type="button" className={`transport${lcd === item.id ? " is-on" : ""}`} onClick={() => setLcd(item.id)}>
                {item.label} lamp
              </button>
            ))}
          </div>
          <div className="row-scroll">
            <button type="button" className={`transport${showPlaylist ? " is-on" : ""}`} onClick={() => setShowPlaylist(!showPlaylist)}>
              Playlist
            </button>
            <button type="button" className={`transport${showEq ? " is-on" : ""}`} onClick={() => setShowEq(!showEq)}>
              Equalizer
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
