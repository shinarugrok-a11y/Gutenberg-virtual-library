import { useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Repeat, Repeat1, Rewind, FastForward, Shuffle, SkipBack, SkipForward, X } from "lucide-react";
import { useDesk, type LcdId, type SkinId } from "@/lib/desk-store";

type Track = { id: string; name: string; url: string; size: number };

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

const MB = 1024 * 1024;
const MAX_FILE_BYTES = 300 * MB;
const MAX_TOTAL_BYTES = 1024 * MB;
const MAX_TRACKS = 200;
const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|webm|weba|aif|aiff)$/i;

function clock(seconds: number) {
  if (!Number.isFinite(seconds)) return "--:--";
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${String(m).padStart(2, "0")}:${s}`;
}

function isAudio(file: File) {
  return file.type.startsWith("audio/") || (!file.type && AUDIO_EXT.test(file.name)) || (file.type === "video/webm" && AUDIO_EXT.test(file.name));
}

function megabytes(bytes: number) {
  return `${Math.round(bytes / MB)} MB`;
}

export function Winamp({ onAir, motion, sleepFade }: { onAir: boolean; motion: boolean; sleepFade: number }) {
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
  const [notice, setNotice] = useState("");
  const [fade, setFade] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const tracksRef = useRef(tracks);
  const indexRef = useRef(index);
  const failuresRef = useRef(0);
  const brokenRef = useRef(new Set<string>());
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  tracksRef.current = tracks;
  indexRef.current = index;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
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
    const onMeta = () => setDuration(audio.duration);
    const onPlaying = () => {
      failuresRef.current = 0;
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeAttribute("src");
      void ctx.close();
      for (const track of tracksRef.current) URL.revokeObjectURL(track.url);
    };
  }, []);

  async function start(audio: HTMLAudioElement) {
    try {
      await ctxRef.current?.resume();
      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof DOMException && error.name === "NotSupportedError") {
        reportBroken(true);
        return;
      }
      setPlaying(false);
      setNotice("The browser would not start playback. Press play again.");
    }
  }

  function load(at: number, autoplay: boolean) {
    const audio = audioRef.current;
    const track = tracksRef.current[at];
    if (!audio || !track) return;
    setIndex(at);
    setTime(0);
    setDuration(0);
    audio.src = track.url;
    if (autoplay) void start(audio);
  }

  function nextIndex(from: number, wrap: boolean): number | null {
    const list = tracksRef.current;
    if (!list.length) return null;
    if (shuffle && list.length > 1) {
      let next = Math.floor(Math.random() * list.length);
      if (next === from) next = (next + 1) % list.length;
      return next;
    }
    if (from + 1 < list.length) return from + 1;
    return wrap ? 0 : null;
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = () => {
      if (repeat === "one") {
        audio.currentTime = 0;
        void start(audio);
        return;
      }
      const next = nextIndex(indexRef.current, repeat === "all");
      if (next == null) {
        setPlaying(false);
        return;
      }
      load(next, true);
    };
    audio.onerror = () => reportBroken(!audio.paused || playing);
  });

  function reportBroken(advance: boolean) {
    const list = tracksRef.current;
    const bad = list[indexRef.current];
    setPlaying(false);
    if (bad && !brokenRef.current.has(bad.id)) {
      brokenRef.current.add(bad.id);
      setBroken(new Set(brokenRef.current));
    }
    setNotice(`${bad ? `“${bad.name}”` : "That file"} can't be played. It may be damaged or in a format this browser does not support.`);
    if (!advance) return;
    failuresRef.current += 1;
    if (failuresRef.current >= list.length) return;
    const next = list.findIndex((track, i) => i > indexRef.current && !brokenRef.current.has(track.id));
    const wrap = next >= 0 ? next : list.findIndex((track) => !brokenRef.current.has(track.id));
    if (wrap >= 0 && wrap !== indexRef.current) load(wrap, true);
  }

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume * (onAir ? 0.28 : 1) * fade;
  }, [volume, onAir, fade]);

  useEffect(() => {
    if (!sleepFade) return;
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      setFade(Math.max(0, 1 - step / 20));
      if (step >= 20) {
        window.clearInterval(timer);
        audio.pause();
        setFade(1);
      }
    }, 400);
    return () => {
      window.clearInterval(timer);
      setFade(1);
    };
  }, [sleepFade]);

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

  function loadFiles(input: HTMLInputElement) {
    const list = input.files;
    if (!list?.length) return;
    const next = [...tracks];
    let total = next.reduce((sum, track) => sum + track.size, 0);
    const skipped: string[] = [];
    for (const file of list) {
      if (!isAudio(file)) {
        skipped.push(`${file.name} (not an audio file)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(`${file.name} (${megabytes(file.size)}, over the ${megabytes(MAX_FILE_BYTES)} limit)`);
        continue;
      }
      if (total + file.size > MAX_TOTAL_BYTES) {
        skipped.push(`${file.name} (the deck holds ${megabytes(MAX_TOTAL_BYTES)} in total)`);
        continue;
      }
      if (next.length >= MAX_TRACKS) {
        skipped.push(`${file.name} (the deck holds ${MAX_TRACKS} records)`);
        continue;
      }
      total += file.size;
      next.push({
        id: `${file.name}-${file.size}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name.replace(/\.[^.]+$/, "") || file.name || "Untitled record",
        url: URL.createObjectURL(file),
        size: file.size,
      });
    }
    input.value = "";
    setNotice(skipped.length ? `Left out ${skipped.length}: ${skipped.slice(0, 3).join("; ")}${skipped.length > 3 ? "…" : ""}` : "");
    tracksRef.current = next;
    setTracks(next);
    failuresRef.current = 0;
    if (!audioRef.current?.getAttribute("src") && next[0]) load(0, false);
  }

  function remove(at: number) {
    const audio = audioRef.current;
    const gone = tracks[at];
    if (!gone || !audio) return;
    const next = tracks.filter((_, i) => i !== at);
    tracksRef.current = next;
    setTracks(next);
    if (at === index) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setTime(0);
      setDuration(0);
      if (next.length) load(Math.min(at, next.length - 1), false);
      else setIndex(0);
    } else if (at < index) setIndex(index - 1);
    URL.revokeObjectURL(gone.url);
  }

  function clearAll() {
    const audio = audioRef.current;
    audio?.pause();
    audio?.removeAttribute("src");
    audio?.load();
    for (const track of tracks) URL.revokeObjectURL(track.url);
    tracksRef.current = [];
    setTracks([]);
    setIndex(0);
    setTime(0);
    setDuration(0);
    setNotice("");
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !tracks.length) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (!audio.getAttribute("src")) {
      load(Math.min(index, tracks.length - 1), true);
      return;
    }
    if (brokenRef.current.has(tracks[index]?.id ?? "")) {
      reportBroken(true);
      return;
    }
    if (audio.ended) audio.currentTime = 0;
    setNotice("");
    await start(audio);
  }

  function go(next: number) {
    const audio = audioRef.current;
    if (!audio || !tracks.length) return;
    const at = (next + tracks.length) % tracks.length;
    load(at, !audio.paused || playing);
  }

  function nudge(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
    setTime(audio.currentTime);
  }

  const track = tracks[index];
  const seekable = Number.isFinite(duration) && duration > 0;

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
        <p className="m-0 text-sm tabular-nums">
          {clock(time)} / {seekable ? clock(duration) : "--:--"}
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
        max={seekable ? duration : 0}
        step={0.1}
        disabled={!seekable}
        value={seekable ? Math.min(time, duration) : 0}
        aria-label="Seek"
        onChange={(event) => {
          const audio = audioRef.current;
          if (!audio || !seekable) return;
          audio.currentTime = Number(event.target.value);
          setTime(audio.currentTime);
        }}
      />
      <div className="transport-row mt-2 flex flex-wrap items-center justify-between gap-1">
        <button type="button" className={`transport${shuffle ? " is-on" : ""}`} aria-pressed={shuffle} aria-label="Shuffle" onClick={() => setShuffle((value) => !value)}>
          <Shuffle className="size-4" />
        </button>
        <button type="button" className="transport" aria-label="Previous" onClick={() => go(index - 1)} disabled={!tracks.length}>
          <SkipBack className="size-4" />
        </button>
        <button type="button" className="transport" aria-label="Back 15 seconds" onClick={() => nudge(-15)} disabled={!seekable}>
          <Rewind className="size-4" />
        </button>
        <button type="button" className="transport" aria-label={playing ? "Pause" : "Play"} onClick={() => void toggle()} disabled={!tracks.length}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button type="button" className="transport" aria-label="Forward 30 seconds" onClick={() => nudge(30)} disabled={!seekable}>
          <FastForward className="size-4" />
        </button>
        <button type="button" className="transport" aria-label="Next" onClick={() => go(index + 1)} disabled={!tracks.length}>
          <SkipForward className="size-4" />
        </button>
        <button
          type="button"
          className={`transport${repeat !== "off" ? " is-on" : ""}`}
          aria-label={`Repeat ${repeat === "off" ? "off" : repeat === "all" ? "all" : "one"}`}
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
        <input className="sr-only" type="file" accept="audio/*,.mp3,.m4a,.m4b,.aac,.ogg,.opus,.wav,.flac,.webm" multiple onChange={(event) => loadFiles(event.currentTarget)} />
      </label>
      {notice && (
        <p className="player-notice mt-2 text-xs" role="alert">
          {notice}
        </p>
      )}
      <p className="mt-2 text-xs" style={{ color: "var(--p-muted)" }}>
        Your files stay in this browser and are not uploaded. Up to {megabytes(MAX_FILE_BYTES)} per file, {megabytes(MAX_TOTAL_BYTES)} in total. The playlist clears when you
        leave. On air, the book ducks the music.
      </p>
      {showPlaylist && (
        <div className="playlist mt-2">
          {tracks.map((item, i) => (
            <div key={item.id} className={`playlist-row${i === index ? " is-on" : ""}`}>
              <button type="button" className={i === index ? "is-on" : ""} aria-current={i === index ? "true" : undefined} onClick={() => (i === index ? void toggle() : go(i))}>
                {i + 1}. {item.name}
                {broken.has(item.id) ? " — can't play" : ""}
              </button>
              <button type="button" className="playlist-remove" aria-label={`Remove ${item.name}`} onClick={() => remove(i)}>
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {!tracks.length && <p className="text-xs" style={{ color: "var(--p-muted)" }}>No records yet.</p>}
          {tracks.length > 1 && (
            <button type="button" className="playlist-clear" onClick={clearAll}>
              Clear playlist
            </button>
          )}
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
