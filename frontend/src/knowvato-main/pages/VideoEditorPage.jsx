import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Play, Pause, Scissors, Trash2, Download, Film,
  Volume2, VolumeX, Maximize2, Undo2, Redo2, ZoomIn, ZoomOut,
  FileVideo, Check, AlertCircle, Layers, Loader2, Plus, FastForward,
  Rewind, Copy, SlidersHorizontal, Zap, GripVertical, CheckCircle2,
  X, RefreshCw, Sparkles, FileType, Music, Video, Settings2,
  EyeOff, Eye, Square, Circle, Magnet, Clock, ArrowRight,
  Tv, Smartphone, MonitorPlay, Move
} from "lucide-react";

// Helper to format byte sizes
function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return gb.toFixed(2) + " GB";
  return (bytes / (1024 ** 2)).toFixed(1) + " MB";
}

// Helper to format time (MM:SS) without milliseconds
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(m)}:${pad(s)}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Compression quality presets
const QUALITY_PRESETS = [
  { id: "high", label: "High", sub: "75%", ratio: 0.75, bitrate: 4500000, scale: 1 },
  { id: "medium", label: "Medium", sub: "50%", ratio: 0.5, bitrate: 2200000, scale: 0.85 },
  { id: "low", label: "Low", sub: "25%", ratio: 0.25, bitrate: 1000000, scale: 0.65 },
];

// Expanded Format Options
const FORMAT_OPTIONS = [
  { id: "mp4", label: "MP4", tag: "Universal", type: "video", ext: "mp4", desc: "H.264 / AAC — Compatible with all phones, WhatsApp, Windows, Mac" },
  { id: "webm", label: "WebM", tag: "Web / VP9", type: "video", ext: "webm", desc: "VP9 / Opus — High compression for web streaming & browsers" },
  { id: "mov", label: "MOV", tag: "QuickTime", type: "video", ext: "mov", desc: "Apple QuickTime format for iPhone, iPad, Mac" },
  { id: "mkv", label: "MKV", tag: "Matroska", type: "video", ext: "mkv", desc: "High fidelity container for VLC & media centers" },
  { id: "avi", label: "AVI", tag: "Classic", type: "video", ext: "avi", desc: "Standard Windows video container" },
  { id: "mp3", label: "MP3", tag: "Audio Only", type: "audio", ext: "mp3", desc: "Extract and convert soundtrack to standard MP3" },
  { id: "m4a", label: "M4A", tag: "AAC Audio", type: "audio", ext: "m4a", desc: "High quality AAC audio track extraction" },
];

// Resolution Options
const RESOLUTION_OPTIONS = [
  { id: "original", label: "Original", scale: 1 },
  { id: "1080p", label: "1080p FHD", width: 1920, height: 1080 },
  { id: "720p", label: "720p HD", width: 1280, height: 720 },
  { id: "480p", label: "480p SD", width: 854, height: 480 },
  { id: "360p", label: "360p Low", width: 640, height: 360 },
];

// Export Aspect Ratios / Frame Sizes
const exportAspectRatios = [
  { id: "16:9", label: "16:9 Landscape", sub: "YouTube, TV, Laptop (1920x1080)", width: 1920, height: 1080, icon: Tv },
  { id: "9:16", label: "9:16 Vertical", sub: "Reels, Shorts, TikTok (1080x1920)", width: 1080, height: 1920, icon: Smartphone },
  { id: "1:1",  label: "1:1 Square", sub: "Instagram Post (1080x1080)", width: 1080, height: 1080, icon: Square },
  { id: "4:5",  label: "4:5 Portrait", sub: "Social Media Feed (1080x1350)", width: 1080, height: 1350, icon: MonitorPlay },
];

// Timeline Scale Resolution Steps (Granularity & Horizontal Stretch from 0.1s up to 10 minutes)
const SCALE_STEPS = [
  { interval: 0.1, label: "0.1s", pxPerSec: 350 },
  { interval: 0.5, label: "0.5s", pxPerSec: 180 },
  { interval: 1,   label: "1s",   pxPerSec: 90 },
  { interval: 2,   label: "2s",   pxPerSec: 45 },
  { interval: 3,   label: "3s",   pxPerSec: 30 },
  { interval: 4,   label: "4s",   pxPerSec: 22 },
  { interval: 5,   label: "5s",   pxPerSec: 18 },
  { interval: 10,  label: "10s",  pxPerSec: 10 },
  { interval: 15,  label: "15s",  pxPerSec: 6 },
  { interval: 30,  label: "30s",  pxPerSec: 3 },
  { interval: 60,  label: "1m",   pxPerSec: 1.6 },
  { interval: 120, label: "2m",   pxPerSec: 0.8 },
  { interval: 180, label: "3m",   pxPerSec: 0.55 },
  { interval: 300, label: "5m",   pxPerSec: 0.35 },
  { interval: 600, label: "10m",  pxPerSec: 0.2 },
];

export default function VideoEditor() {
  // Mode: "edit" (Timeline Studio) or "compress" (Fast Compressor)
  const [mode, setMode] = useState("edit");

  // Media Bin
  const [files, setFiles] = useState([]);
  const [activeMediaId, setActiveMediaId] = useState(null);
  const [dragOverBin, setDragOverBin] = useState(false);

  // Playback & Timeline Time
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mutedMaster, setMutedMaster] = useState(false);

  // Tracks (Default: T1, T2, T3)
  const [tracks, setTracks] = useState([
    { id: "track-1", name: "T1", muted: false, clips: [] },
    { id: "track-2", name: "T2", muted: false, clips: [] },
    { id: "track-3", name: "T3", muted: false, clips: [] },
  ]);
  const [selectedTrackId, setSelectedTrackId] = useState("track-1");
  const [selectedClipId, setSelectedClipId] = useState(null);

  // Undo / Redo
  const [history, setHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);

  // Timeline Navigation & Scale Resolution
  const [scaleStepIndex, setScaleStepIndex] = useState(2); // default: 1s
  const currentScale = SCALE_STEPS[scaleStepIndex] || SCALE_STEPS[2];
  const [extraDuration, setExtraDuration] = useState(0);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const [snapGuide, setSnapGuide] = useState(null);
  const [ghostPlacement, setGhostPlacement] = useState(null);
  const [timelineDragOver, setTimelineDragOver] = useState(false);

  // Active Dragging State (Clip Move or Corner Trim)
  const [draggingState, setDraggingState] = useState(null);
  const dragRafRef = useRef(null);

  // Blur / Mask Redaction State
  const [blurMasks, setBlurMasks] = useState([]);
  const [selectedBlurId, setSelectedBlurId] = useState(null);
  const [draggingBlur, setDraggingBlur] = useState(null);

  // Export Modal & Engine
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("mp4");
  const [exportAspect, setExportAspect] = useState("16:9");
  const [exportResolution, setExportResolution] = useState("1080p");
  const [exportFps, setExportFps] = useState(30);
  const [exportQuality, setExportQuality] = useState("high");
  const [exportStripAudio, setExportStripAudio] = useState(false);
  const [exportDurationMode, setExportDurationMode] = useState("video"); // "video" | "all" | "custom"
  const [exportCustomDuration, setExportCustomDuration] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportRenderTime, setExportRenderTime] = useState(0);
  const [exportResult, setExportResult] = useState(null);
  const [exportError, setExportError] = useState("");
  const exportPreviewCanvasRef = useRef(null);

  // Fast Compressor State
  const [compressFileId, setCompressFileId] = useState(null);
  const [compressQuality, setCompressQuality] = useState("medium");
  const [compressFormat, setCompressFormat] = useState("mp4");
  const [compressResolution, setCompressResolution] = useState("original");
  const [compressStripAudio, setCompressStripAudio] = useState(false);
  const [customTargetMB, setCustomTargetMB] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState(0);
  const [compressResult, setCompressResult] = useState(null);
  const [compressError, setCompressError] = useState("");

  // Refs
  const videoRef = useRef(null);
  const videoPlayersRef = useRef({});
  const cinemaStageRef = useRef(null);
  const timelineTracksRef = useRef(null);
  const timelineScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const audioPlayersRef = useRef({});
  const playheadRafRef = useRef(null);
  const lastPlayTimeRef = useRef(Date.now());
  // Context menu for clip actions (cut range)
  const [clipContextMenu, setClipContextMenu] = useState({ visible: false, x: 0, y: 0, trackId: null, clipId: null, from: "", to: "", showAbove: false });

  // Calculate video-only clips max end (where video content actually ends)
  const videoClipsMaxEnd = Math.max(
    ...tracks
      .filter((t) => !t.isAudio)
      .flatMap((t) => t.clips.map((c) => (c.type !== "audio" ? (c.startTime || 0) + Math.max(0.01, c.trimEnd - c.trimStart) : 0))),
    0
  );

  // Calculate master timeline duration across all tracks (including audio)
  const calculatedMaxEnd = Math.max(
    ...tracks.flatMap((t) =>
      t.clips.map((c) => (c.startTime || 0) + Math.max(0.01, c.trimEnd - c.trimStart))
    ),
    0
  );

  const effectiveExportDuration = exportDurationMode === "custom" && Number(exportCustomDuration) > 0
    ? Number(exportCustomDuration)
    : (exportDurationMode === "all" ? (calculatedMaxEnd > 0 ? calculatedMaxEnd : 10) : (videoClipsMaxEnd > 0 ? videoClipsMaxEnd : (calculatedMaxEnd > 0 ? calculatedMaxEnd : 10)));

  const minRequiredDuration = calculatedMaxEnd > 0 ? Math.max(2, calculatedMaxEnd) : 2;
  const totalTimelineDuration = Math.max(
    2,
    Math.max(minRequiredDuration, (calculatedMaxEnd > 0 ? calculatedMaxEnd + 2 : 12) + extraDuration)
  );

  // All video clips flattened across all tracks for preloaded multi-video stage
  const allVideoClips = tracks

    .filter((t) => !t.isAudio)
    .flatMap((t) => t.clips.map((c) => ({ ...c, trackId: t.id, trackMuted: t.muted })))
    .filter((c) => c.type !== "audio");

  // Helper to find currently selected clip
  const currentSelectedTrack = tracks.find((t) => t.id === selectedTrackId) || null;
  const currentSelectedClip = currentSelectedTrack?.clips.find((c) => c.id === selectedClipId) || null;

  // Active clip at current playback playhead time (for video stage preview)
  const findActiveClipAtTime = (time) => {
    const videoTracks = tracks.filter((t) => !t.isAudio);
    const sortedTracks = selectedTrackId
      ? [
          ...videoTracks.filter((t) => t.id === selectedTrackId),
          ...videoTracks.filter((t) => t.id !== selectedTrackId),
        ]
      : videoTracks;

    for (const track of sortedTracks) {
      for (const clip of track.clips) {
        if (clip.type === "audio") continue;
        const clipStart = Number(clip.startTime) || 0;
        const cTrimStart = Number(clip.trimStart) || 0;
        const cTrimEnd = Number(clip.trimEnd) || Number(clip.originalDuration) || 10;
        const clipEnd = clipStart + Math.max(0.01, cTrimEnd - cTrimStart);
        if (time >= clipStart && time <= clipEnd + 0.04) {
          return { clip, track };
        }
      }
    }
    return null;
  };


  const activePlayback = findActiveClipAtTime(currentTime);
  const activeVideoUrl = activePlayback
    ? activePlayback.clip.url
    : (currentSelectedClip?.type !== "audio" ? currentSelectedClip?.url : (files.find((f) => f.id === activeMediaId)?.url || null));
  const activeClipMuted = activePlayback ? activePlayback.clip.isMuted || activePlayback.track.muted : false;

  // Sync Audio Tracks Playback with current playhead time
  const syncAudioToPlayhead = useCallback((time, playingState) => {
    const allAudioClips = [];
    tracks.forEach((t) => {
      t.clips.forEach((c) => {
        if (c.type === "audio" || t.isAudio) {
          allAudioClips.push({ clip: c, track: t });
        }
      });
    });

    allAudioClips.forEach(({ clip, track }) => {
      let player = audioPlayersRef.current[clip.id];
      if (!player) {
        player = new Audio(clip.url);
        player.preload = "auto";
        audioPlayersRef.current[clip.id] = player;
      }

      const clipStart = clip.startTime || 0;
      const clipEnd = clipStart + (clip.trimEnd - clip.trimStart);
      const isClipActive = time >= clipStart && time <= clipEnd;
      const shouldPlay = isClipActive && playingState && !track.muted && !clip.isMuted;

      player.muted = track.muted || clip.isMuted || false;
      player.volume = typeof clip.volume === "number" ? clip.volume : 1;

      if (isClipActive) {
        const offset = time - clipStart;
        const targetTime = clip.trimStart + offset;
        if (Math.abs(player.currentTime - targetTime) > 0.25) {
          try {
            player.currentTime = Math.max(clip.trimStart, Math.min(clip.trimEnd, targetTime));
          } catch (e) {}
        }
        if (shouldPlay && player.paused) {
          player.play().catch(() => {});
        } else if (!shouldPlay && !player.paused) {
          player.pause();
        }
      } else {
        if (!player.paused) player.pause();
      }
    });
  }, [tracks]);

  // Master Playback Loop (Continuous 60fps Playhead with Pre-warmed Multi-Track Video Handshake)
  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    if (!isPlaying) {
      if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
      Object.values(videoPlayersRef.current).forEach((v) => {
        if (v && !v.paused) v.pause();
      });
      Object.values(audioPlayersRef.current).forEach((p) => {
        if (p && !p.paused) p.pause();
      });
      return;
    }

    lastPlayTimeRef.current = performance.now();
    let currentActiveClipId = null;

    const loop = () => {
      const now = performance.now();
      const deltaSec = (now - lastPlayTimeRef.current) / 1000;
      lastPlayTimeRef.current = now;

      const prevTime = currentTimeRef.current;
      const nextTime = prevTime + deltaSec;

      const activeMatch = findActiveClipAtTime(nextTime);

      if (activeMatch) {
        const activeClip = activeMatch.clip;
        const vEl = videoPlayersRef.current[activeClip.id];

        if (vEl) {
          const clipStart = Number(activeClip.startTime) || 0;
          const targetVideoTime = (Number(activeClip.trimStart) || 0) + (nextTime - clipStart);

          // If we just entered or switched to this clip, initialize its position and play
          if (currentActiveClipId !== activeClip.id) {
            currentActiveClipId = activeClip.id;
            try {
              vEl.currentTime = Math.max(activeClip.trimStart, Math.min(activeClip.trimEnd, targetVideoTime));
            } catch (e) {}
            vEl.play().catch(() => {});
          } else {
            // Keep active player running and correct any playback drift gently
            if (vEl.paused) {
              vEl.play().catch(() => {});
            } else if (Math.abs(vEl.currentTime - targetVideoTime) > 0.3) {
              try {
                vEl.currentTime = targetVideoTime;
              } catch (e) {}
            }
          }
        }
      } else {
        currentActiveClipId = null;
      }

      // Pause any non-active video players
      Object.entries(videoPlayersRef.current).forEach(([clipId, v]) => {
        if (v && clipId !== activeMatch?.clip.id && !v.paused) {
          v.pause();
        }
      });

      if (nextTime >= totalTimelineDuration) {
        setIsPlaying(false);
        currentTimeRef.current = 0;
        setCurrentTime(0);
        seekTo(0);
        return;
      }

      currentTimeRef.current = nextTime;
      setCurrentTime(nextTime);
      syncAudioToPlayhead(nextTime, true);

      playheadRafRef.current = requestAnimationFrame(loop);
    };

    playheadRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
    };

  }, [isPlaying, totalTimelineDuration, tracks, allVideoClips, syncAudioToPlayhead]);

  // Spacebar toggle playback & Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        splitCurrentClip();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedClipId && selectedTrackId) {
          deleteClip(selectedTrackId, selectedClipId);
        } else if (selectedBlurId) {
          deleteBlurMask(selectedBlurId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tracks, selectedTrackId, selectedClipId, selectedBlurId, currentTime, history, redoHistory]);

  // Close clip context menu on outside click or Esc
  useEffect(() => {
    const onClick = (e) => {
      if (clipContextMenu.visible) setClipContextMenu((s) => ({ ...s, visible: false }));
    };
    const onKey = (e) => {
      if (e.key === "Escape" && clipContextMenu.visible) setClipContextMenu((s) => ({ ...s, visible: false }));
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [clipContextMenu.visible]);

  const formatSecondsInput = (s) => {
    if (typeof s !== "number" || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const parseTimeString = (str) => {
    if (!str) return 0;
    const parts = String(str).split(":").map((p) => p.trim());
    if (parts.length === 1) return Number(parts[0]) || 0;
    if (parts.length === 2) return (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0);
    if (parts.length === 3) return (Number(parts[0]) || 0) * 3600 + (Number(parts[1]) || 0) * 60 + (Number(parts[2]) || 0);
    return 0;
  };

  const openClipContextMenu = (e, trackId, clip) => {
    e.preventDefault();
    e.stopPropagation();
    const clipStart = clip.startTime || 0;
    const clipDur = Math.max(0.01, clip.trimEnd - clip.trimStart);
    const clipEnd = clipStart + clipDur;
    const spaceBelow = window.innerHeight - e.clientY;
    const approxMenuHeight = 160; // estimate; used to decide if we should show above
    const showAbove = spaceBelow < approxMenuHeight;
    setClipContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      trackId,
      clipId: clip.id,
      from: formatSecondsInput(clipStart),
      to: formatSecondsInput(clipEnd),
      showAbove,
    });
  };

  const cutClipRange = (trackId, clipId, fromSec, toSec) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return;
    const clip = track.clips[clipIndex];

    const clipStart = clip.startTime || 0;
    const clipDur = Math.max(0.01, clip.trimEnd - clip.trimStart);
    const clipEnd = clipStart + clipDur;

    // clamp range to clip
    const cutFrom = Math.max(clipStart, Math.min(clipEnd, fromSec));
    const cutTo = Math.max(clipStart, Math.min(clipEnd, toSec));
    if (cutTo <= cutFrom) return;

    pushHistory(tracks);

    const relFrom = cutFrom - clipStart; // seconds into clip
    const relTo = cutTo - clipStart;

    const newClips = [];

    // left piece
    if (relFrom > 0.01) {
      newClips.push({
        ...clip,
        id: uid(),
        trimStart: clip.trimStart,
        trimEnd: clip.trimStart + relFrom,
        startTime: clipStart,
      });
    }

    // right piece
    if (relTo < clipDur - 0.01) {
      newClips.push({
        ...clip,
        id: uid(),
        trimStart: clip.trimStart + relTo,
        trimEnd: clip.trimEnd,
        startTime: clipStart + relTo,
      });
    }

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: [...t.clips.slice(0, clipIndex), ...newClips, ...t.clips.slice(clipIndex + 1)],
        };
      })
    );
    setClipContextMenu((s) => ({ ...s, visible: false }));
  };

  const keepOnlyRange = (trackId, clipId, fromSec, toSec) => {
    const track = tracks.find((t) => t.id === trackId);
    if (!track) return;
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex === -1) return;
    const clip = track.clips[clipIndex];

    const clipStart = clip.startTime || 0;
    const clipDur = Math.max(0.01, clip.trimEnd - clip.trimStart);
    const clipEnd = clipStart + clipDur;

    // clamp range to clip
    const cutFrom = Math.max(clipStart, Math.min(clipEnd, fromSec));
    const cutTo = Math.max(clipStart, Math.min(clipEnd, toSec));
    if (cutTo <= cutFrom) return;

    pushHistory(tracks);

    const relFrom = cutFrom - clipStart; // seconds into clip
    const relTo = cutTo - clipStart;

    const newClip = {
      ...clip,
      id: uid(),
      trimStart: clip.trimStart + relFrom,
      trimEnd: clip.trimStart + relTo,
      startTime: clipStart + relFrom,
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          clips: [...t.clips.slice(0, clipIndex), newClip, ...t.clips.slice(clipIndex + 1)],
        };
      })
    );
    setClipContextMenu((s) => ({ ...s, visible: false }));
  };

  // Push History for Undo
  const pushHistory = (newTracks) => {
    setHistory((prev) => [...prev.slice(-25), JSON.parse(JSON.stringify(newTracks))]);
    setRedoHistory([]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setRedoHistory((prev) => [...prev, JSON.parse(JSON.stringify(tracks))]);
    setTracks(previous);
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const next = redoHistory[redoHistory.length - 1];
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(tracks))]);
    setTracks(next);
    setRedoHistory((prev) => prev.slice(0, -1));
  };

  // Playhead Seek Helper
  const seekTo = (time) => {
    const clamped = Math.max(0, Math.min(totalTimelineDuration, time));
    currentTimeRef.current = clamped;
    setCurrentTime(clamped);
    const activeMatch = findActiveClipAtTime(clamped);

    allVideoClips.forEach((c) => {
      const vEl = videoPlayersRef.current[c.id];
      if (!vEl) return;
      const isThisActive = activeMatch?.clip.id === c.id;
      const isSelected = selectedClipId === c.id;

      if (isThisActive || (!activeMatch && isSelected)) {
        const cStart = Number(c.startTime) || 0;
        const cTrimStart = Number(c.trimStart) || 0;
        const cTrimEnd = Number(c.trimEnd) || Number(c.originalDuration) || 10;
        const targetTime = cTrimStart + Math.max(0, clamped - cStart);
        try {
          vEl.currentTime = Math.max(cTrimStart, Math.min(cTrimEnd, targetTime));
        } catch (e) {}
        if (isPlaying && vEl.paused) {
          vEl.play().catch(() => {});
        } else if (!isPlaying && !vEl.paused) {
          vEl.pause();
        }
      } else {
        if (!vEl.paused) vEl.pause();
      }
    });

    syncAudioToPlayhead(clamped, isPlaying);
  };


  const togglePlay = () => {
    if (currentTimeRef.current >= totalTimelineDuration - 0.05) {
      seekTo(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((p) => {
      const nextState = !p;
      const curT = currentTimeRef.current;
      const activeMatch = findActiveClipAtTime(curT);

      allVideoClips.forEach((c) => {
        const vEl = videoPlayersRef.current[c.id];
        if (!vEl) return;
        const isThisActive = activeMatch?.clip.id === c.id;
        if (nextState && isThisActive) {
          const targetTime = c.trimStart + (curT - (c.startTime || 0));
          try {
            vEl.currentTime = Math.max(c.trimStart, Math.min(c.trimEnd, targetTime));
          } catch (e) {}
          vEl.play().catch(() => {});
        } else {
          if (!vEl.paused) vEl.pause();
        }
      });

      return nextState;
    });
  };

  // ----------------------------------------------------
  // Cross-Track Magnetic Snapping Calculation Helper
  // ----------------------------------------------------
  const computeSnapPosition = (trackId, targetTime, clipDuration = 5, excludeClipId = null) => {
    if (!snappingEnabled) {
      return { snappedTime: Math.max(0, targetTime), snapGuide: null };
    }

    const snapTargets = [
      { time: 0, label: "0:00 (Timeline Start)", isEnd: false, trackName: "Start" },
      { time: currentTime, label: `Playhead (${formatTime(currentTime)})`, isEnd: false, trackName: "Playhead" }
    ];

    // Scan ALL tracks in the project for seamless cross-track transitions
    tracks.forEach((t) => {
      t.clips.forEach((c) => {
        if (c.id === excludeClipId) return;
        const cStart = c.startTime || 0;
        const cDur = Math.max(0.01, c.trimEnd - c.trimStart);
        const cEnd = cStart + cDur;
        const isOtherTrack = t.id !== trackId;
        const trackTag = `[${t.name}]`;

        // 1. Clip End Target (Essential for placing video right after previous clip)
        snapTargets.push({
          time: cEnd,
          label: isOtherTrack ? `${trackTag} "${c.name}" End (${formatTime(cEnd)})` : `"${c.name}" End (${formatTime(cEnd)})`,
          isEnd: true,
          trackName: t.name,
          clipName: c.name,
        });

        // 2. Clip Start Target
        snapTargets.push({
          time: cStart,
          label: isOtherTrack ? `${trackTag} "${c.name}" Start (${formatTime(cStart)})` : `"${c.name}" Start (${formatTime(cStart)})`,
          isEnd: false,
          trackName: t.name,
          clipName: c.name,
        });
      });
    });

    // Snapping sensitivity: intuitive ~0.6s threshold on timeline
    const threshold = Math.max(0.25, Math.min(1.0, (totalTimelineDuration / 800) * 12));
    let closestTarget = null;
    let minDiff = Infinity;

    // Check snapping for clip start against all targets (e.g. snapping start to previous clip end)
    for (const st of snapTargets) {
      const diff = Math.abs(targetTime - st.time);
      if (diff < threshold && diff < minDiff) {
        minDiff = diff;
        closestTarget = {
          snappedTime: Math.max(0, st.time),
          label: st.isEnd ? `Seamless after ${st.label}` : `Align with ${st.label}`,
          snapTime: st.time,
          trackName: st.trackName,
        };
      }
    }

    // Check snapping for clip end against all targets
    for (const st of snapTargets) {
      const diff = Math.abs((targetTime + clipDuration) - st.time);
      if (diff < threshold && diff < minDiff) {
        minDiff = diff;
        closestTarget = {
          snappedTime: Math.max(0, st.time - clipDuration),
          label: `Snap end to ${st.label}`,
          snapTime: st.time,
          trackName: st.trackName,
        };
      }
    }

    if (closestTarget) {
      const leftPct = (closestTarget.snapTime / (totalTimelineDuration || 1)) * 100;
      return {
        snappedTime: Math.max(0, closestTarget.snappedTime),
        snapGuide: { leftPct, label: closestTarget.label, trackName: closestTarget.trackName },
      };
    }

    return { snappedTime: Math.max(0, targetTime), snapGuide: null };
  };

  // Extract video metadata and thumbnail safely
  const processSingleFile = async (file) => {
    const url = URL.createObjectURL(file);
    const tempVideo = document.createElement("video");
    tempVideo.preload = "auto";
    tempVideo.muted = true;
    tempVideo.playsInline = true;

    let dur = 10;
    try {
      dur = await new Promise((resolve) => {
        let isDone = false;
        const done = (finalDur) => {
          if (!isDone) {
            isDone = true;
            clearTimeout(timeout);
            resolve(finalDur && isFinite(finalDur) && finalDur > 0 ? finalDur : 10);
          }
        };

        const timeout = setTimeout(() => {
          const fallback = tempVideo.duration && isFinite(tempVideo.duration) && tempVideo.duration > 0
            ? tempVideo.duration
            : 10;
          done(fallback);
        }, 4000);

        const onMetaOrData = () => {
          if (tempVideo.duration && isFinite(tempVideo.duration) && tempVideo.duration > 0) {
            done(tempVideo.duration);
          } else if (tempVideo.duration === Infinity) {
            // WebM Infinity duration workaround: seek to very end to determine true duration
            tempVideo.currentTime = 1e101;
            tempVideo.ontimeupdate = () => {
              tempVideo.ontimeupdate = null;
              const trueDur = isFinite(tempVideo.duration) && tempVideo.duration > 0
                ? tempVideo.duration
                : (isFinite(tempVideo.currentTime) && tempVideo.currentTime > 0 ? tempVideo.currentTime : 10);
              tempVideo.currentTime = 0;
              done(trueDur);
            };
          }
        };

        tempVideo.onloadedmetadata = onMetaOrData;
        tempVideo.ondurationchange = onMetaOrData;
        tempVideo.onloadeddata = onMetaOrData;
        tempVideo.oncanplay = onMetaOrData;
        tempVideo.onerror = () => done(10);
        tempVideo.src = url;
      });
    } catch (e) {
      dur = 10;
    }

    let thumb = null;
    try {
      tempVideo.currentTime = Math.min(1, Math.max(0.1, (dur || 10) / 2));
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 600);
        tempVideo.onseeked = () => {
          clearTimeout(t);
          resolve();
        };
        tempVideo.onerror = () => {
          clearTimeout(t);
          resolve();
        };
      });
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext("2d");
      if (ctx && tempVideo.videoWidth && tempVideo.videoHeight) {
        ctx.drawImage(tempVideo, 0, 0, 160, 90);
        thumb = canvas.toDataURL("image/jpeg", 0.7);
      }
    } catch (err) {
      console.warn("Thumbnail generation skipped:", err);
    }

    return {
      id: uid(),
      name: file.name,
      size: file.size,
      duration: dur,
      url,
      thumb,
      fileRef: file,
    };
  };

  // Upload video files into Media Bin (Parallel multi-file support)
  const handleUploadFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    const newItems = await Promise.all(filesArray.map((f) => processSingleFile(f)));

    setFiles((prev) => [...prev, ...newItems]);
    if (newItems.length > 0) {
      setActiveMediaId(newItems[0].id);
      setCompressFileId(newItems[0].id);
    }
  };

  // Remove file from bin
  const removeFile = (id) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((x) => x.id !== id);
    });
    if (activeMediaId === id) setActiveMediaId(null);
    if (compressFileId === id) setCompressFileId(null);
  };

  // Add Clip to Track
  const addFileToTimeline = (fileEntry, targetTrackId = "track-1", atTime = null) => {
    if (!fileEntry) return;
    pushHistory(tracks);
    const dur = fileEntry.duration || 10;

    let startOffset = 0;
    if (atTime !== null && atTime >= 0) {
      startOffset = atTime;
    } else {
      const targetTrack = tracks.find((t) => t.id === targetTrackId) || tracks[0];
      if (targetTrack && targetTrack.clips.length > 0) {
        const lastClip = targetTrack.clips[targetTrack.clips.length - 1];
        startOffset = (lastClip.startTime || 0) + (lastClip.trimEnd - lastClip.trimStart);
      }
    }

    const { snappedTime } = computeSnapPosition(targetTrackId, startOffset, dur);

    const newClip = {
      id: uid(),
      fileId: fileEntry.id,
      name: fileEntry.name,
      url: fileEntry.url,
      thumb: fileEntry.thumb,
      originalDuration: dur,
      trimStart: 0,
      trimEnd: dur,
      startTime: snappedTime,
      isMuted: false,
    };

    setTracks((prev) =>
      prev.map((t) => (t.id === targetTrackId ? { ...t, clips: [...t.clips, newClip] } : t))
    );

    setSelectedTrackId(targetTrackId);
    setSelectedClipId(newClip.id);
  };

  // Add Audio Track from selected MP3 files
  const handleAudioTrackUpload = async (e) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);

    const newAudioTracks = [];
    let currentAudioCount = tracks.filter((t) => t.isAudio).length;

    for (const file of filesArray) {
      currentAudioCount += 1;
      const url = URL.createObjectURL(file);
      const tempAudio = new Audio(url);
      tempAudio.preload = "metadata";

      let dur = 10;
      try {
        dur = await new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(10), 2000);
          tempAudio.onloadedmetadata = () => {
            clearTimeout(timeout);
            resolve(tempAudio.duration && isFinite(tempAudio.duration) && tempAudio.duration > 0 ? tempAudio.duration : 10);
          };
          tempAudio.onerror = () => {
            clearTimeout(timeout);
            resolve(10);
          };
        });
      } catch (err) {
        dur = 10;
      }

      const newClip = {
        id: uid(),
        name: file.name,
        url,
        type: "audio",
        originalDuration: dur,
        trimStart: 0,
        trimEnd: dur,
        startTime: 0,
        isMuted: false,
        volume: 1,
        fileRef: file,
      };

      const newTrack = {
        id: `audio-track-${uid()}`,
        name: `A${currentAudioCount}`,
        isAudio: true,
        muted: false,
        clips: [newClip],
      };

      newAudioTracks.push(newTrack);
    }

    if (newAudioTracks.length > 0) {
      pushHistory(tracks);
      setTracks((prev) => [...prev, ...newAudioTracks]);
      setSelectedTrackId(newAudioTracks[0].id);
      setSelectedClipId(newAudioTracks[0].clips[0].id);
    }

    e.target.value = "";
  };

  // Add New Track (triggers MP3 Audio file selection)
  const addNewTrack = () => {
    audioInputRef.current?.click();
  };

  // Split Selected Clip at current playhead position
  // Split Clip at current playhead cursor position
  const splitCurrentClip = () => {
    // 1. Check selected track and clip first
    let targetTrack = null;
    let targetClip = null;
    let clipIndex = -1;

    if (selectedTrackId && selectedClipId) {
      const t = tracks.find((tr) => tr.id === selectedTrackId);
      if (t) {
        const idx = t.clips.findIndex((c) => c.id === selectedClipId);
        if (idx !== -1) {
          const c = t.clips[idx];
          const cStart = Number(c.startTime) || 0;
          const cDur = Math.max(0.01, (Number(c.trimEnd) || 10) - (Number(c.trimStart) || 0));
          const cEnd = cStart + cDur;
          if (currentTime >= cStart - 0.1 && currentTime <= cEnd + 0.1) {
            targetTrack = t;
            targetClip = c;
            clipIndex = idx;
          }
        }
      }
    }

    // 2. If no target clip from selection, search all tracks for any clip under currentTime
    if (!targetClip) {
      for (const t of tracks) {
        const idx = t.clips.findIndex((c) => {
          const cStart = Number(c.startTime) || 0;
          const cDur = Math.max(0.01, (Number(c.trimEnd) || 10) - (Number(c.trimStart) || 0));
          const cEnd = cStart + cDur;
          return currentTime >= cStart && currentTime <= cEnd;
        });
        if (idx !== -1) {
          targetTrack = t;
          targetClip = t.clips[idx];
          clipIndex = idx;
          break;
        }
      }
    }

    if (!targetTrack || !targetClip || clipIndex === -1) {
      return;
    }

    const clipStartOnTimeline = Number(targetClip.startTime) || 0;
    const origDuration = Number(targetClip.originalDuration) || Number(targetClip.trimEnd) || 10;
    const cTrimStart = Number(targetClip.trimStart) || 0;
    const cTrimEnd = Number(targetClip.trimEnd) || origDuration;
    const clipEndOnTimeline = clipStartOnTimeline + (cTrimEnd - cTrimStart);

    // Calculate effective split timestamp (clamp slightly inside clip bounds if near edges)
    let effectiveSplitTime = currentTime;
    if (effectiveSplitTime <= clipStartOnTimeline + 0.05) {
      effectiveSplitTime = clipStartOnTimeline + 0.1;
    } else if (effectiveSplitTime >= clipEndOnTimeline - 0.05) {
      effectiveSplitTime = clipEndOnTimeline - 0.1;
    }

    if (effectiveSplitTime <= clipStartOnTimeline || effectiveSplitTime >= clipEndOnTimeline) {
      return;
    }

    pushHistory(tracks);

    const relativeSplitOffset = effectiveSplitTime - clipStartOnTimeline;
    const splitPointVideoTime = cTrimStart + relativeSplitOffset;

    const clipA = {
      ...targetClip,
      id: uid(),
      originalDuration: origDuration,
      trimStart: cTrimStart,
      trimEnd: splitPointVideoTime,
      startTime: clipStartOnTimeline,
    };

    const clipB = {
      ...targetClip,
      id: uid(),
      originalDuration: origDuration,
      trimStart: splitPointVideoTime,
      trimEnd: cTrimEnd,
      startTime: clipStartOnTimeline + relativeSplitOffset,
    };

    setTracks((prev) =>
      prev.map((t) =>
        t.id === targetTrack.id
          ? {
              ...t,
              clips: [...t.clips.slice(0, clipIndex), clipA, clipB, ...t.clips.slice(clipIndex + 1)],
            }
          : t
      )
    );

    setSelectedTrackId(targetTrack.id);
    setSelectedClipId(clipB.id);
  };




  // Mute / Remove Voice on Clip
  const toggleClipMute = (trackId, clipId, e) => {
    if (e) e.stopPropagation();
    pushHistory(tracks);
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, isMuted: !c.isMuted } : c)),
            }
          : t
      )
    );
  };

  // Delete Clip from Track
  const deleteClip = (trackId, clipId, e) => {
    if (e) e.stopPropagation();
    pushHistory(tracks);
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) } : t))
    );
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  };

  // Duplicate Clip
  const duplicateClip = (trackId, clipId, e) => {
    if (e) e.stopPropagation();
    const track = tracks.find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    if (!clip) return;

    pushHistory(tracks);
    const clipDuration = clip.trimEnd - clip.trimStart;
    const newStartTime = (clip.startTime || 0) + clipDuration;

    const newClip = {
      ...clip,
      id: uid(),
      startTime: newStartTime,
    };

    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t))
    );
    setSelectedClipId(newClip.id);
  };

  // ----------------------------------------------------
  // Blur / Mask Redaction Handlers
  // ----------------------------------------------------
  const addBlurMask = () => {
    const maskDuration = Math.min(5, Math.max(2, totalTimelineDuration - currentTime));
    const start = Math.max(0, Math.min(totalTimelineDuration - 1, currentTime));
    const end = Math.min(totalTimelineDuration, start + (maskDuration > 0 ? maskDuration : 4));

    const newMask = {
      id: `blur-${uid()}`,
      name: `Blur ${blurMasks.length + 1}`,
      shape: "rect",
      x: 35, // percent
      y: 35, // percent
      width: 30, // percent
      height: 18, // percent
      blurAmount: 16, // px
      borderRadius: 8, // px
      timeStart: Math.round(start * 10) / 10,
      timeEnd: Math.round(end * 10) / 10,
    };
    setBlurMasks((prev) => [...prev, newMask]);
    setSelectedBlurId(newMask.id);
  };

  const updateBlurMask = (id, updates) => {
    setBlurMasks((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const deleteBlurMask = (id, e) => {
    if (e) e.stopPropagation();
    setBlurMasks((prev) => prev.filter((m) => m.id !== id));
    if (selectedBlurId === id) setSelectedBlurId(null);
  };

  // Stage 8-Point Blur Drag & Resizing Engine
  const handleBlurMouseDown = (e, mask, mode = "move") => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedBlurId(mask.id);

    const stageRect = cinemaStageRef.current?.getBoundingClientRect();
    if (!stageRect) return;

    setDraggingBlur({
      maskId: mask.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: mask.x,
      origY: mask.y,
      origW: mask.width,
      origH: mask.height,
      stageW: stageRect.width,
      stageH: stageRect.height,
    });
  };

  useEffect(() => {
    if (!draggingBlur) return;

    const handleMouseMove = (e) => {
      const deltaXPct = ((e.clientX - draggingBlur.startX) / (draggingBlur.stageW || 1)) * 100;
      const deltaYPct = ((e.clientY - draggingBlur.startY) / (draggingBlur.stageH || 1)) * 100;

      setBlurMasks((prev) =>
        prev.map((m) => {
          if (m.id !== draggingBlur.maskId) return m;

          let { origX, origY, origW, origH, mode } = draggingBlur;
          let newX = m.x;
          let newY = m.y;
          let newW = m.width;
          let newH = m.height;

          if (mode === "move") {
            newX = Math.max(0, Math.min(100 - origW, origX + deltaXPct));
            newY = Math.max(0, Math.min(100 - origH, origY + deltaYPct));
            return { ...m, x: Math.round(newX * 10) / 10, y: Math.round(newY * 10) / 10 };
          }

          // Horizontal adjustments (chauda / patla)
          if (mode.includes("e")) {
            newW = Math.max(4, Math.min(100 - origX, origW + deltaXPct));
          } else if (mode.includes("w")) {
            newX = Math.max(0, Math.min(origX + origW - 4, origX + deltaXPct));
            newW = origW - (newX - origX);
          }

          // Vertical adjustments (lamba / chota)
          if (mode.includes("s")) {
            newH = Math.max(4, Math.min(100 - origY, origH + deltaYPct));
          } else if (mode.includes("n")) {
            newY = Math.max(0, Math.min(origY + origH - 4, origY + deltaYPct));
            newH = origH - (newY - origY);
          }

          return {
            ...m,
            x: Math.round(newX * 10) / 10,
            y: Math.round(newY * 10) / 10,
            width: Math.round(newW * 10) / 10,
            height: Math.round(newH * 10) / 10,
          };
        })
      );
    };

    const handleMouseUp = () => {
      setDraggingBlur(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingBlur]);

  // Timeline Blur Clip Move & Duration Trimming Engine
  const [draggingBlurTimeline, setDraggingBlurTimeline] = useState(null);

  const handleBlurTimelineMouseDown = (e, mask, mode = "move") => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedBlurId(mask.id);

    const laneEl = e.currentTarget.closest('[data-track-lane="true"]');
    const laneWidth = laneEl ? laneEl.getBoundingClientRect().width : 800;

    setDraggingBlurTimeline({
      maskId: mask.id,
      mode,
      startX: e.clientX,
      origStart: mask.timeStart,
      origEnd: mask.timeEnd,
      origDur: mask.timeEnd - mask.timeStart,
      laneWidth,
    });
  };

  useEffect(() => {
    if (!draggingBlurTimeline) return;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - draggingBlurTimeline.startX;
      const secPerPx = totalTimelineDuration / (draggingBlurTimeline.laneWidth || 800);
      const deltaSec = deltaX * secPerPx;

      setBlurMasks((prev) =>
        prev.map((m) => {
          if (m.id !== draggingBlurTimeline.maskId) return m;

          if (draggingBlurTimeline.mode === "move") {
            const dur = draggingBlurTimeline.origDur;
            const newStart = Math.max(0, Math.min(totalTimelineDuration - dur, draggingBlurTimeline.origStart + deltaSec));
            return {
              ...m,
              timeStart: Math.round(newStart * 10) / 10,
              timeEnd: Math.round((newStart + dur) * 10) / 10,
            };
          } else if (draggingBlurTimeline.mode === "trim-start") {
            const newStart = Math.max(0, Math.min(m.timeEnd - 0.2, draggingBlurTimeline.origStart + deltaSec));
            return { ...m, timeStart: Math.round(newStart * 10) / 10 };
          } else if (draggingBlurTimeline.mode === "trim-end") {
            const newEnd = Math.max(m.timeStart + 0.2, Math.min(totalTimelineDuration, draggingBlurTimeline.origEnd + deltaSec));
            return { ...m, timeEnd: Math.round(newEnd * 10) / 10 };
          }
          return m;
        })
      );
    };

    const handleMouseUp = () => {
      setDraggingBlurTimeline(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingBlurTimeline, totalTimelineDuration]);

  // ----------------------------------------------------
  // Timeline Drag & Drop Engine (Multi-Track + Snapping)
  // ----------------------------------------------------
  const handleClipMouseDown = (e, trackId, clip, mode = "move") => {
    e.stopPropagation();
    if (e.button !== 0) return;

    setSelectedTrackId(trackId);
    setSelectedClipId(clip.id);

    // Immediately seek to exact cursor position on mousedown when clicking to select/move
    if (mode === "move") {
      seekFromClientX(e.clientX);
    }

    const laneEl = timelineTracksRef.current?.querySelector(`[data-track-id="${trackId}"] [data-track-lane="true"]`);
    const laneWidth = laneEl ? (laneEl.offsetWidth || laneEl.clientWidth || laneEl.getBoundingClientRect().width) : 800;


    setDraggingState({
      mode,
      trackId,
      currentTrackId: trackId,
      clipId: clip.id,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
      laneWidth,
      origStartTime: Number(clip.startTime) || 0,
      origTrimStart: Number(clip.trimStart) || 0,
      origTrimEnd: Number(clip.trimEnd) || Number(clip.originalDuration) || 10,
      origDuration: Number(clip.originalDuration) || Number(clip.trimEnd) || 10,
      clipDuration: Math.max(0.1, (Number(clip.trimEnd) || 10) - (Number(clip.trimStart) || 0)),
    });
  };


  useEffect(() => {
    if (!draggingState) return;

    const handleMouseMove = (e) => {
      const dist = Math.hypot(e.clientX - draggingState.startX, e.clientY - draggingState.startY);
      if (!draggingState.hasMoved && dist < 4) return;

      if (!draggingState.hasMoved) {
        pushHistory(tracks);
        draggingState.hasMoved = true;
      }

      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);

      dragRafRef.current = requestAnimationFrame(() => {
        const deltaX = e.clientX - draggingState.startX;
        const secondsPerPixel = totalTimelineDuration / (draggingState.laneWidth || 800);
        const deltaSec = deltaX * secondsPerPixel;

        let targetTrackId = draggingState.currentTrackId;
        if (draggingState.mode === "move") {
          try {
            const elementsUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
            const trackEl = elementsUnderCursor.find(
              (el) => el.getAttribute && el.getAttribute("data-track-id")
            );
            if (trackEl) {
              const detectedTrackId = trackEl.getAttribute("data-track-id");
              if (detectedTrackId) targetTrackId = detectedTrackId;
            }
          } catch (err) {}
        }

        const isChangingTrack = targetTrackId !== draggingState.currentTrackId;

        setTracks((prev) => {
          if (draggingState.mode === "move") {
            const rawStartTime = Math.max(0, draggingState.origStartTime + deltaSec);
            const { snappedTime, snapGuide: guide } = computeSnapPosition(
              targetTrackId,
              rawStartTime,
              draggingState.clipDuration,
              draggingState.clipId
            );

            setSnapGuide(guide);

            // Anti-Overlap Collision Prevention on Target Track:
            const currentTrackClips = (prev.find((t) => t.id === targetTrackId)?.clips || [])
              .filter((c) => c.id !== draggingState.clipId)
              .sort((a, b) => (Number(a.startTime) || 0) - (Number(b.startTime) || 0));

            let finalStartTime = snappedTime;
            const movingDuration = draggingState.clipDuration;

            for (const other of currentTrackClips) {
              const oStart = Number(other.startTime) || 0;
              const oEnd = oStart + Math.max(0.01, (Number(other.trimEnd) || 10) - (Number(other.trimStart) || 0));

              // If finalStartTime overlaps with `other`
              if (finalStartTime < oEnd && finalStartTime + movingDuration > oStart) {
                if (Math.abs(finalStartTime - oEnd) < Math.abs((finalStartTime + movingDuration) - oStart)) {
                  finalStartTime = oEnd;
                } else {
                  finalStartTime = Math.max(0, oStart - movingDuration);
                }
              }
            }

            if (isChangingTrack) {
              let movingClip = null;
              const withoutClip = prev.map((t) => {
                if (t.id === draggingState.currentTrackId) {
                  const found = t.clips.find((c) => c.id === draggingState.clipId);
                  if (found) movingClip = found;
                  return { ...t, clips: t.clips.filter((c) => c.id !== draggingState.clipId) };
                }
                return t;
              });

              if (!movingClip) return prev;

              const updatedClip = { ...movingClip, startTime: finalStartTime };
              return withoutClip.map((t) => {
                if (t.id === targetTrackId) {
                  return { ...t, clips: [...t.clips, updatedClip] };
                }
                return t;
              });
            } else {
              return prev.map((t) => {
                if (t.id !== draggingState.currentTrackId) return t;
                return {
                  ...t,
                  clips: t.clips.map((c) => {
                    if (c.id !== draggingState.clipId) return c;
                    return { ...c, startTime: finalStartTime };
                  }),
                };
              });
            }
          } else {

            // Trim start / end
            setSnapGuide(null);
            return prev.map((t) => {
              if (t.id !== draggingState.trackId) return t;
              return {
                ...t,
                clips: t.clips.map((c) => {
                  if (c.id !== draggingState.clipId) return c;

                  if (draggingState.mode === "trim-start") {
                    const origTrimEnd = Number(draggingState.origTrimEnd) || Number(c.trimEnd) || 10;
                    const origTrimStart = Number(draggingState.origTrimStart) || 0;
                    const maxTrim = origTrimEnd - 0.1;
                    const newTrimStart = Math.max(0, Math.min(maxTrim, origTrimStart + deltaSec));
                    const trimShift = newTrimStart - origTrimStart;
                    const newStartTime = Math.max(0, (draggingState.origStartTime || 0) + trimShift);
                    return { ...c, trimStart: newTrimStart, startTime: newStartTime };
                  } else if (draggingState.mode === "trim-end") {
                    const origTrimStart = Number(draggingState.origTrimStart) || 0;
                    const origTrimEnd = Number(draggingState.origTrimEnd) || Number(c.trimEnd) || 10;
                    const maxDuration = Number(draggingState.origDuration) || Number(c.originalDuration) || 99999;
                    const minTrim = origTrimStart + 0.1;
                    const newTrimEnd = Math.min(
                      maxDuration,
                      Math.max(minTrim, origTrimEnd + deltaSec)
                    );
                    return { ...c, trimEnd: newTrimEnd };
                  }

                  return c;
                }),
              };
            });
          }
        });

        if (isChangingTrack) {
          draggingState.currentTrackId = targetTrackId;
          setSelectedTrackId(targetTrackId);
        }
      });
    };

    const handleMouseUp = () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      setDraggingState(null);
      setSnapGuide(null);
      setGhostPlacement(null);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointerup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointerup", handleMouseUp);
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    };
  }, [draggingState, totalTimelineDuration, snappingEnabled]);

  // Timeline Seeking & Scrubbing
  const seekFromClientX = (clientX) => {
    if (!timelineTracksRef.current) return;
    const laneElements = timelineTracksRef.current.querySelectorAll('[data-track-lane="true"]');
    const targetLane = laneElements[0];
    if (!targetLane) return;

    const rect = targetLane.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * totalTimelineDuration;
    seekTo(targetTime);
  };

  const handleRulerMouseDown = (e) => {
    e.preventDefault();
    seekFromClientX(e.clientX);

    const onScrubMove = (moveEvent) => {
      seekFromClientX(moveEvent.clientX);
    };

    const onScrubUp = () => {
      window.removeEventListener("mousemove", onScrubMove);
      window.removeEventListener("mouseup", onScrubUp);
    };

    window.addEventListener("mousemove", onScrubMove);
    window.addEventListener("mouseup", onScrubUp);
  };

  const handleTimelineRulerClick = (e) => {
    seekFromClientX(e.clientX);
  };

  const handleTrackLaneClick = (e, trackId) => {
    if (draggingState && draggingState.hasMoved) return;
    seekFromClientX(e.clientX);
    setSelectedTrackId(trackId);
  };

  const handleClipClick = (e, trackId, clip) => {
    e.stopPropagation();
    if (draggingState && draggingState.hasMoved) return;
    setSelectedTrackId(trackId);
    setSelectedClipId(clip.id);
    seekFromClientX(e.clientX);
  };


  // Drag & Drop File from Media Bin into Track
  const handleTimelineDragOver = (e, trackId) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const rawPct = Math.max(0, Math.min(1, clickX / rect.width));
    const rawTime = rawPct * totalTimelineDuration;

    const fileId = e.dataTransfer.getData("text/video-id") || activeMediaId;
    const targetFile = files.find((f) => f.id === fileId);
    const dragDur = targetFile ? targetFile.duration : 10;

    const { snappedTime, snapGuide: guide } = computeSnapPosition(trackId, rawTime, dragDur);
    setSnapGuide(guide);
    setGhostPlacement({
      trackId,
      startTime: snappedTime,
      duration: dragDur,
      leftPct: (snappedTime / (totalTimelineDuration || 1)) * 100,
      widthPct: (dragDur / (totalTimelineDuration || 1)) * 100,
    });
  };

  const handleTimelineDrop = (e, trackId) => {
    e.preventDefault();
    setTimelineDragOver(false);
    setSnapGuide(null);
    setGhostPlacement(null);

    const fileId = e.dataTransfer.getData("text/video-id");
    const targetFile = files.find((f) => f.id === fileId);

    if (targetFile) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      const rawTime = pct * totalTimelineDuration;
      const { snappedTime } = computeSnapPosition(trackId, rawTime, targetFile.duration || 10);
      addFileToTimeline(targetFile, trackId || "track-1", snappedTime);
    }
  };

  // ----------------------------------------------------
  // Full Multi-Track & Blur Export Render Engine
  // ----------------------------------------------------
  const isExportCancelledRef = useRef(false);

  const runProjectExport = async (opts = {}) => {
    const activeClipsCount = tracks.flatMap((t) => t.clips).length;
    if (activeClipsCount === 0) {
      setExportError("Please add at least one video to the timeline before exporting.");
      return;
    }

    setExporting(true);
    setExportProgress(0);
    setExportRenderTime(0);
    setExportError("");
    setExportResult(null);
    isExportCancelledRef.current = false;

    const selectedAspectConfig = exportAspectRatios.find((a) => a.id === exportAspect) || exportAspectRatios[0];
    let targetWidth = selectedAspectConfig.width;
    let targetHeight = selectedAspectConfig.height;

    if (exportResolution === "720p") {
      targetWidth = Math.round(targetWidth * 0.666);
      targetHeight = Math.round(targetHeight * 0.666);
    } else if (exportResolution === "480p") {
      targetWidth = Math.round(targetWidth * 0.444);
      targetHeight = Math.round(targetHeight * 0.444);
    }

    targetWidth = Math.round(targetWidth / 2) * 2;
    targetHeight = Math.round(targetHeight / 2) * 2;

    // Calculate exact duration
    const targetDuration = effectiveExportDuration > 0 ? effectiveExportDuration : (videoClipsMaxEnd > 0 ? videoClipsMaxEnd : 10);
    const exportDuration = Math.max(1, Math.round(targetDuration * 100) / 100);

    const videoTracks = tracks.filter((t) => !t.isAudio);
    const primaryClip = videoTracks.flatMap((t) => t.clips.map((c) => ({ ...c, trackMuted: t.muted })))[0];
    const srcFileEntry = primaryClip
      ? (files.find((f) => f.id === primaryClip.fileId) || files.find((f) => f.url === primaryClip.url) || files[0])
      : files[0];

    // Fast-path: Direct Native FFmpeg Processing for instant 100% accurate duration & quality export
    if (srcFileEntry?.fileRef && videoTracks.flatMap((t) => t.clips).length <= 1) {
      try {
        setExportProgress(15);
        setExportRenderTime(0);

        const form = new FormData();
        form.append("file", srcFileEntry.fileRef, srcFileEntry.name || "video.mp4");
        form.append("trimStart", String(primaryClip ? (primaryClip.trimStart || 0) : 0));
        form.append("duration", String(exportDuration));
        form.append("isMuted", String(Boolean(mutedMaster || (primaryClip && primaryClip.isMuted) || (primaryClip && primaryClip.trackMuted) || exportStripAudio)));
        form.append("targetWidth", String(targetWidth));
        form.append("targetHeight", String(targetHeight));
        form.append("fps", String(exportFps || 30));
        form.append("quality", exportQuality || "high");
        form.append("format", exportFormat || "mp4");
        if (blurMasks.length > 0) {
          form.append("blurMasks", JSON.stringify(blurMasks));
        }

        const progressTimer = setInterval(() => {
          setExportProgress((p) => {
            if (p < 90) return p + 15;
            return p;
          });
        }, 250);

        const resp = await fetch("/api/media/process", {
          method: "POST",
          body: form,
        });
        clearInterval(progressTimer);

        if (resp.ok) {
          const array = await resp.arrayBuffer();
          const mime = exportFormat === "mp3" ? "audio/mpeg" : (exportFormat === "m4a" ? "audio/mp4" : (exportFormat === "webm" ? "video/webm" : "video/mp4"));
          const outBlob = new Blob([array], { type: mime });
          const url = URL.createObjectURL(outBlob);
          const outExt = (exportFormat === "mp3" || exportFormat === "m4a") ? exportFormat : (exportFormat === "mov" ? "mov" : (exportFormat === "webm" ? "webm" : "mp4"));
          const outName = `Export_${exportAspect.replace(":", "-")}_${Date.now()}.${outExt}`;

          setExportResult({
            url,
            name: outName,
            size: outBlob.size,
            format: exportFormat.toUpperCase(),
            aspect: exportAspect,
            resolution: `${targetWidth}x${targetHeight}`,
            duration: exportDuration,
          });
          setExportProgress(100);
          setExportRenderTime(exportDuration);
          setExporting(false);
          return;
        }
      } catch (fastErr) {
        console.warn("[export] Fast native export fallback to canvas renderer:", fastErr);
      }
    }

    // Create a DOM container placed inside viewport to prevent browser video throttling
    const renderContainer = document.createElement("div");
    renderContainer.style.cssText = "position:fixed;bottom:0;right:0;width:320px;height:240px;opacity:0.001;pointer-events:none;overflow:hidden;z-index:-1;";
    document.body.appendChild(renderContainer);

    let audioCtx = null;
    let audioDest = null;
    let recorder = null;
    let animationFrameId = null;

    const cleanupResources = (clipElements) => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (clipElements) {
        clipElements.forEach((v) => {
          try { v.pause(); v.src = ""; v.load(); } catch (e) {}
        });
      }
      try {
        if (renderContainer && renderContainer.parentNode) {
          renderContainer.parentNode.removeChild(renderContainer);
        }
      } catch (e) {}
      try {
        if (audioCtx && audioCtx.state !== "closed") {
          audioCtx.close().catch(() => {});
        }
      } catch (e) {}
    };

    try {
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false }) || canvas.getContext("2d");

      // Initial solid background fill
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Scratch canvas for safe blur rendering
      const scratchCanvas = document.createElement("canvas");
      const scratchCtx = scratchCanvas.getContext("2d");

      // Audio context for multi-track audio mixing
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !exportStripAudio && exportFormat !== "gif") {
          audioCtx = new AudioContextClass();
          if (audioCtx.state === "suspended") await audioCtx.resume();
          audioDest = audioCtx.createMediaStreamDestination();
        }
      } catch (e) {
        console.warn("Audio Context init fallback:", e);
      }

      // Prepare video elements for all unique clips
      const clipElements = new Map();
      const clipPlayingState = new Map();

      for (const track of tracks) {
        for (const clip of track.clips) {
          if (!clipElements.has(clip.id)) {
            const v = document.createElement("video");
            v.src = clip.url;
            if (!clip.url.startsWith("blob:")) {
              v.crossOrigin = "anonymous";
            }
            v.preload = "auto";
            v.playsInline = true;
            v.disablePictureInPicture = true;
            v.muted = !audioDest || clip.isMuted || track.muted;
            renderContainer.appendChild(v);

            await new Promise((r) => {
              let done = false;
              const finish = () => { if (!done) { done = true; clearTimeout(timer); r(); } };
              const timer = setTimeout(finish, 2000);
              v.onloadedmetadata = finish;
              v.onloadeddata = finish;
              v.oncanplay = finish;
              v.onerror = finish;
            });

            // Cue to trimStart
            try { v.currentTime = clip.trimStart || 0; } catch (e) {}

            clipElements.set(clip.id, v);
            clipPlayingState.set(clip.id, false);

            if (audioCtx && audioDest && !clip.isMuted && !track.muted) {
              try {
                const src = audioCtx.createMediaElementSource(v);
                src.connect(audioDest);
              } catch (err) {}
            }
          }
        }
      }

      // Stream & Recorder
      const stream = canvas.captureStream(exportFps);
      if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
        stream.addTrack(audioDest.stream.getAudioTracks()[0]);
      }

      let mimeType = "";
      if (exportFormat === "mp3" || exportFormat === "m4a") {
        const audioMimes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
        mimeType = audioMimes.find((m) => MediaRecorder.isTypeSupported(m)) || "audio/webm";
      } else if (exportFormat === "mp4" || exportFormat === "mov") {
        const mp4Mimes = [
          'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
          "video/mp4;codecs=h264,aac",
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm"
        ];
        mimeType = mp4Mimes.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
      } else {
        const webmMimes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
          "video/mp4"
        ];
        mimeType = webmMimes.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
      }

      const bitrates = {
        high: targetWidth >= 1920 ? 8000000 : 5000000,
        medium: targetWidth >= 1920 ? 4500000 : 3000000,
        low: 1500000,
      };

      const recorderOpts = {
        videoBitsPerSecond: bitrates[exportQuality] || 5000000,
        audioBitsPerSecond: 192000,
      };
      if (mimeType && MediaRecorder.isTypeSupported(mimeType)) {
        recorderOpts.mimeType = mimeType;
      }

      recorder = new MediaRecorder(stream, recorderOpts);

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onerror = (e) => {
        console.error("[export] MediaRecorder error:", e);
        setExportError("Recorder encountered an error while exporting.");
        if (recorder && recorder.state === "recording") {
          try { recorder.stop(); } catch (err) {}
        }
        cleanupResources(clipElements);
        setExporting(false);
      };

      let exportStartWallTime = 0;
      let lastReportedPct = -1;

      const updateProgress = (currTime, totalTime) => {
        const pct = Math.min(99, Math.max(0, Math.round((currTime / totalTime) * 100)));
        if (pct !== lastReportedPct) {
          lastReportedPct = pct;
          setExportProgress(pct);
          setExportRenderTime(currTime);
        }
      };

      // Start recorder immediately to synchronize wall-clock recording duration perfectly
      recorder.start(100);
      exportStartWallTime = performance.now();

      const renderStep = (now) => {
        if (isExportCancelledRef.current) {
          cleanupResources(clipElements);
          return;
        }

        try {
          // Precise wall-clock elapsed time (guarantees exact video duration)
          const renderTime = (now - exportStartWallTime) / 1000;

          if (renderTime >= exportDuration) {
            clipElements.forEach((v) => {
              try { v.pause(); } catch (e) {}
            });
            if (recorder && recorder.state === "recording") {
              recorder.stop();
            }
            return;
          }

          let anyVideoDrawn = false;

          // 1. Active Video Frame Synchronization & Drawing (Flicker-Free)
          for (const track of tracks) {
            if (track.isAudio) continue;
            for (const clip of track.clips) {
              if (clip.type === "audio") continue;
              const cStart = clip.startTime || 0;
              const cDur = Math.max(0.01, clip.trimEnd - clip.trimStart);
              const cEnd = cStart + cDur;
              const v = clipElements.get(clip.id);
              const isPlaying = clipPlayingState.get(clip.id);
              const shouldBeActive = renderTime >= cStart && renderTime <= cEnd;

              if (shouldBeActive && v) {
                const targetVideoTime = clip.trimStart + (renderTime - cStart);

                // Start playback smoothly if not started
                if (!isPlaying || v.paused) {
                  try {
                    v.currentTime = Math.max(clip.trimStart, Math.min(clip.trimEnd, targetVideoTime));
                    v.play().catch(() => {});
                    clipPlayingState.set(clip.id, true);
                  } catch (e) {}
                } else if (Math.abs(v.currentTime - targetVideoTime) > 0.35) {
                  // Gentle sync only on significant drift to prevent seeking freezes
                  try {
                    v.currentTime = Math.max(clip.trimStart, Math.min(clip.trimEnd, targetVideoTime));
                  } catch (e) {}
                }

                if (v.videoWidth && v.videoHeight && v.readyState >= 2) {
                  const vRatio = v.videoWidth / v.videoHeight;
                  const cRatio = targetWidth / targetHeight;
                  let dw = targetWidth;
                  let dh = targetHeight;
                  let dx = 0;
                  let dy = 0;
                  if (vRatio > cRatio) {
                    dh = targetWidth / vRatio;
                    dy = (targetHeight - dh) / 2;
                  } else {
                    dw = targetHeight * vRatio;
                    dx = (targetWidth - dw) / 2;
                  }
                  try {
                    ctx.drawImage(v, dx, dy, dw, dh);
                    anyVideoDrawn = true;
                  } catch (e) {}
                }
              } else if (!shouldBeActive && v && isPlaying) {
                try { v.pause(); } catch (e) {}
                clipPlayingState.set(clip.id, false);
              }
            }
          }

          // If no video was active at this timepoint (e.g. blank gap), clear to black
          if (!anyVideoDrawn) {
            ctx.fillStyle = "#090d16";
            ctx.fillRect(0, 0, targetWidth, targetHeight);
          }

          // 2. Bake Blur Masks onto the Frame
          for (const mask of blurMasks) {
            if (renderTime >= mask.timeStart && renderTime <= mask.timeEnd) {
              const mx = Math.max(0, Math.floor((mask.x / 100) * targetWidth));
              const my = Math.max(0, Math.floor((mask.y / 100) * targetHeight));
              const mw = Math.min(targetWidth - mx, Math.max(2, Math.ceil((mask.width / 100) * targetWidth)));
              const mh = Math.min(targetHeight - my, Math.max(2, Math.ceil((mask.height / 100) * targetHeight)));

              if (mw > 0 && mh > 0) {
                scratchCanvas.width = mw;
                scratchCanvas.height = mh;
                scratchCtx.clearRect(0, 0, mw, mh);
                try {
                  scratchCtx.drawImage(canvas, mx, my, mw, mh, 0, 0, mw, mh);
                  ctx.save();
                  ctx.beginPath();
                  if (mask.shape === "circle") {
                    ctx.ellipse(mx + mw / 2, my + mh / 2, mw / 2, mh / 2, 0, 0, Math.PI * 2);
                  } else if (ctx.roundRect) {
                    const r = Math.min(mw / 2, mh / 2, (mask.borderRadius ?? 8) * (targetWidth / 800));
                    ctx.roundRect(mx, my, mw, mh, r);
                  } else {
                    ctx.rect(mx, my, mw, mh);
                  }
                  ctx.clip();
                  ctx.filter = `blur(${mask.blurAmount || 16}px)`;
                  ctx.drawImage(scratchCanvas, 0, 0, mw, mh, mx, my, mw, mh);
                  ctx.filter = "none";
                  ctx.restore();
                } catch (maskErr) {
                  ctx.restore();
                }
              }
            }
          }

          // 3. Update Live Preview in Modal
          if (exportPreviewCanvasRef.current) {
            const pCanvas = exportPreviewCanvasRef.current;
            const pCtx = pCanvas.getContext("2d");
            if (pCtx) {
              pCtx.drawImage(canvas, 0, 0, pCanvas.width, pCanvas.height);
            }
          }

          updateProgress(renderTime, exportDuration);
          animationFrameId = requestAnimationFrame(renderStep);
        } catch (err) {
          console.error("[export] renderStep error:", err);
          setExportError((err && err.message) || "Error during export rendering.");
          if (recorder && recorder.state === "recording") {
            try { recorder.stop(); } catch (e) {}
          }
          cleanupResources(clipElements);
          setExporting(false);
        }
      };

      animationFrameId = requestAnimationFrame(renderStep);

      await new Promise((resolve) => {
        recorder.onstop = () => {
          (async () => {
            try {
              cleanupResources(clipElements);
              const blob = new Blob(chunks, { type: mimeType || "video/webm" });
              const outExt = (exportFormat === "mp3" || exportFormat === "m4a") ? exportFormat : (exportFormat === "mov" ? "mov" : (exportFormat === "webm" ? "webm" : "mp4"));
              const outName = `Export_${exportAspect.replace(":", "-")}_${Date.now()}.${outExt}`;

              if (blob.size === 0) {
                setExportError("Recorded video stream was empty. Please check your video files.");
                setExporting(false);
                resolve();
                return;
              }

              // Server conversion if WebM produced for MP4
              const isWebMBlob = !blob.type.includes("mp4") && exportFormat === "mp4";
              if (isWebMBlob) {
                try {
                  setExportProgress(95);
                  const form = new FormData();
                  form.append("file", blob, `export.webm`);
                  form.append("targetWidth", String(targetWidth));
                  form.append("targetHeight", String(targetHeight));
                  form.append("fps", String(exportFps || 30));
                  form.append("duration", String(exportDuration));
                  form.append("quality", exportQuality || "high");

                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 180000);
                  const resp = await fetch("/api/media/convert", {
                    method: "POST",
                    body: form,
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);

                  if (resp.ok) {
                    const array = await resp.arrayBuffer();
                    const outBlob = new Blob([array], { type: "video/mp4" });
                    const url = URL.createObjectURL(outBlob);
                    setExportResult({
                      url,
                      name: outName,
                      size: outBlob.size,
                      format: "MP4",
                      aspect: exportAspect,
                      resolution: `${targetWidth}x${targetHeight}`,
                      duration: exportDuration,
                    });
                    setExportProgress(100);
                    setExporting(false);
                    resolve();
                    return;
                  }
                } catch (convErr) {
                  console.warn("[export] server conversion fallback:", convErr);
                }
              }

              // Direct Blob
              const url = URL.createObjectURL(blob);
              setExportResult({
                url,
                name: outName,
                size: blob.size,
                format: exportFormat.toUpperCase(),
                aspect: exportAspect,
                resolution: `${targetWidth}x${targetHeight}`,
                duration: exportDuration,
              });
              setExportProgress(100);
              setExporting(false);
              resolve();
            } catch (finishErr) {
              console.error("[export] finish error:", finishErr);
              setExportError(finishErr.message || "Error completing export.");
              setExporting(false);
              resolve();
            }
          })();
        };
      });
    } catch (err) {
      console.error("Export error:", err);
      cleanupResources();
      setExportError(err.message || "Failed to render video export.");
      setExporting(false);
    }
  };




  // ----------------------------------------------------
  // Fast Compressor Engine
  // ----------------------------------------------------
  const runCompression = async () => {
    const targetFileObj = files.find((f) => f.id === compressFileId) || files[0];
    if (!targetFileObj) {
      setCompressError("Please upload or select a video from the Media Bin to compress.");
      return;
    }

    setCompressing(true);
    setCompressProgress(0);
    setCompressError("");
    setCompressResult(null);

    const renderContainer = document.createElement("div");
    renderContainer.style.cssText = "position:fixed;top:-10000px;left:-10000px;width:10px;height:10px;opacity:0.01;pointer-events:none;overflow:hidden;z-index:-999;";
    document.body.appendChild(renderContainer);

    const video = document.createElement("video");
    video.src = targetFileObj.url;
    video.crossOrigin = "anonymous";
    video.playsInline = true;
    video.preload = "auto";
    video.muted = compressStripAudio;
    renderContainer.appendChild(video);

    let audioCtx = null;
    let recorder = null;
    let drawRaf = null;

    const cleanup = () => {
      if (drawRaf) cancelAnimationFrame(drawRaf);
      try { video.pause(); video.src = ""; video.load(); } catch (e) {}
      try {
        if (renderContainer && renderContainer.parentNode) {
          renderContainer.parentNode.removeChild(renderContainer);
        }
      } catch (e) {}
      try {
        if (audioCtx && audioCtx.state !== "closed") audioCtx.close().catch(() => {});
      } catch (e) {}
    };

    try {
      await new Promise((resolve, reject) => {
        let finished = false;
        const onDone = () => { if (!finished) { finished = true; resolve(); } };
        const timer = setTimeout(onDone, 2000);
        video.onloadedmetadata = () => { clearTimeout(timer); onDone(); };
        video.onerror = () => { clearTimeout(timer); reject(new Error("Unable to read media metadata.")); };
      });

      const originalWidth = video.videoWidth || 1280;
      const originalHeight = video.videoHeight || 720;
      const originalDuration = video.duration || 10;
      const originalSize = targetFileObj.size;

      const isAudioOnly = compressFormat === "mp3" || compressFormat === "m4a";
      let scale = 1;
      let targetW = originalWidth;
      let targetH = originalHeight;

      if (!isAudioOnly) {
        if (compressResolution === "1080p") {
          scale = Math.min(1, 1080 / originalHeight);
        } else if (compressResolution === "720p") {
          scale = Math.min(1, 720 / originalHeight);
        } else if (compressResolution === "480p") {
          scale = Math.min(1, 480 / originalHeight);
        } else if (compressResolution === "360p") {
          scale = Math.min(1, 360 / originalHeight);
        }
        targetW = Math.round((originalWidth * scale) / 2) * 2;
        targetH = Math.round((originalHeight * scale) / 2) * 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true }) || canvas.getContext("2d");

      let stream;
      if (isAudioOnly) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") await audioCtx.resume();
        const source = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        stream = dest.stream;
      } else {
        stream = canvas.captureStream(30);
        if (!compressStripAudio) {
          try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
              audioCtx = new AudioContextClass();
              if (audioCtx.state === "suspended") await audioCtx.resume();
              const source = audioCtx.createMediaElementSource(video);
              const dest = audioCtx.createMediaStreamDestination();
              source.connect(dest);
              const audioTrack = dest.stream.getAudioTracks()[0];
              if (audioTrack) stream.addTrack(audioTrack);
            }
          } catch (audioErr) {
            console.warn("Audio processing fallback applied:", audioErr);
          }
        }
      }

      let mimeType = "video/webm";
      if (compressFormat === "mp4" || compressFormat === "mov") {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs="avc1.42E01E,mp4a.40.2"')) {
          mimeType = 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"';
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
          mimeType = "video/mp4";
        }
      }

      const preset = QUALITY_PRESETS.find((q) => q.id === compressQuality) || QUALITY_PRESETS[1];
      let targetBitrate = preset.bitrate;
      if (customTargetMB && Number(customTargetMB) > 0) {
        targetBitrate = Math.round(((Number(customTargetMB) * 8 * 1024 * 1024) / originalDuration) * 0.9);
      }

      const recorderOpts = {
        videoBitsPerSecond: isAudioOnly ? undefined : targetBitrate,
        audioBitsPerSecond: 128000,
      };
      if (MediaRecorder.isTypeSupported(mimeType)) {
        recorderOpts.mimeType = mimeType;
      }

      recorder = new MediaRecorder(stream, recorderOpts);

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(100);
      video.currentTime = 0;
      await video.play().catch(() => {});

      let lastReportedPct = -1;
      const updateProgress = (curr, total) => {
        const pct = Math.min(99, Math.max(0, Math.round((curr / total) * 100)));
        if (pct !== lastReportedPct) {
          lastReportedPct = pct;
          setCompressProgress(pct);
        }
      };

      const drawLoop = () => {
        if (video.paused || video.ended) return;
        if (!isAudioOnly) {
          try {
            ctx.drawImage(video, 0, 0, targetW, targetH);
          } catch (e) {}
        }
        updateProgress(video.currentTime, originalDuration);
        drawRaf = requestAnimationFrame(drawLoop);
      };
      drawLoop();

      await new Promise((resolve) => {
        video.onended = () => {
          setTimeout(() => {
            if (recorder && recorder.state === "recording") {
              try { recorder.stop(); } catch (e) {}
            }
            resolve();
          }, 300);
        };
      });

      await new Promise((resolve) => {
        recorder.onstop = () => {
          cleanup();
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          const ext = FORMAT_OPTIONS.find((f) => f.id === compressFormat)?.ext || "mp4";
          const rawName = targetFileObj.name.replace(/\.[^/.]+$/, "");
          const outName = `${rawName}_compressed.${ext}`;
          const reductionPct = Math.max(0, Math.round((1 - blob.size / originalSize) * 100));

          setCompressResult({
            url,
            name: outName,
            size: blob.size,
            originalSize,
            reductionPct,
            format: compressFormat.toUpperCase(),
            type: isAudioOnly ? "audio" : "video",
            resolution: `${targetW}x${targetH}`,
            hasAudio: !compressStripAudio,
          });
          setCompressProgress(100);
          setCompressing(false);
          resolve();
        };
      });
    } catch (err) {
      console.error("Compression error:", err);
      cleanup();
      setCompressError(err.message || "Failed to encode media.");
      setCompressing(false);
    }
  };

  const selectedBlurObj = blurMasks.find((m) => m.id === selectedBlurId) || null;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col p-2 bg-slate-100 overflow-hidden select-none font-sans text-slate-900">
      {/* 1. Header Toolbar */}
      <div className="h-10 px-3 bg-white border border-slate-200 rounded-[6px] shadow-xs flex items-center justify-between shrink-0 mb-1.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-[6px] bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 shrink-0">
            <Film className="h-3.5 w-3.5" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-900 tracking-tight leading-tight m-0">Video Studio Pro</h1>
            <p className="text-[9px] text-slate-500 leading-none m-0">Timeline editor, blur redaction & compressor</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switchers */}
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
              mode === "edit"
                ? "bg-slate-900 text-white border border-slate-700 shadow-xs"
                : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs"
            }`}
          >
            <SlidersHorizontal className="h-3 w-3" />
            <span>Editor</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("compress")}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium transition-colors cursor-pointer ${
              mode === "compress"
                ? "bg-slate-900 text-white border border-slate-700 shadow-xs"
                : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs"
            }`}
          >
            <Zap className="h-3 w-3" />
            <span>Compress</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-medium shadow-xs border border-slate-700 transition-colors cursor-pointer"
          >
            <Upload className="h-3 w-3" />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUploadFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Export Project Button */}
          <button
            type="button"
            onClick={() => { setExportResult(null); setExportError(""); setIsExportOpen(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[6px] text-xs font-semibold shadow-xs border border-indigo-700 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Video</span>
          </button>
        </div>
      </div>

      {/* 2. Main Studio Body Container */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-2 min-h-0 overflow-hidden">
        {/* Left: Media Bin Card */}
        <div className="bg-white border border-slate-200 rounded-[6px] shadow-xs flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              MEDIA BIN ({files.length})
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-5.5 w-5.5 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
              title="Add Video File"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverBin(true);
            }}
            onDragLeave={() => setDragOverBin(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverBin(false);
              if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files);
            }}
            className={`flex-1 overflow-y-auto p-2 space-y-2 transition-colors ${
              dragOverBin ? "bg-slate-50" : ""
            }`}
          >
            {files.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="h-full min-h-[140px] p-4 border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50/50 rounded-[6px] flex flex-col items-center justify-center text-center cursor-pointer transition-all"
              >
                <FileVideo className="h-6 w-6 text-slate-400 mb-1" />
                <span className="text-xs font-medium text-slate-700">Drop video here</span>
                <span className="text-[10px] text-slate-400">or click upload</span>
              </div>
            ) : (
              files.map((file) => {
                const isActive = activeMediaId === file.id;
                return (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/video-id", file.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      setActiveMediaId(file.id);
                      if (mode === "compress") setCompressFileId(file.id);
                    }}
                    className={`p-2 rounded-[6px] border transition-all cursor-grab active:cursor-grabbing group relative flex gap-2 items-start ${
                      isActive
                        ? "bg-slate-100 border-slate-400 shadow-2xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70"
                    }`}
                  >
                    {/* Compact Thumbnail */}
                    <div className="w-12 h-8 bg-slate-900 rounded-[6px] overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
                      {file.thumb ? (
                        <img src={file.thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileVideo className="h-3.5 w-3.5 text-slate-400" />
                      )}
                    </div>

                    {/* Metadata with FULL name */}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-slate-800 break-words leading-tight">
                        {file.name}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 mt-1 leading-none">
                        <span>{formatTime(file.duration)}</span>
                        <span>•</span>
                        <span>{formatBytes(file.size)}</span>
                      </div>
                    </div>

                    {/* Delete from Bin Button */}
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        title="Delete from Media Bin"
                        className="h-5.5 w-5.5 inline-flex items-center justify-center rounded-[6px] border border-rose-200 bg-rose-50/70 text-rose-600 hover:text-white hover:bg-rose-600 hover:border-rose-600 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Studio Center Stage */}
        <div className="bg-white border border-slate-200 rounded-[6px] shadow-xs flex flex-col min-h-0 overflow-hidden">
          {mode === "edit" ? (
            /* Timeline Studio Mode */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Cinema Player Stage with Interactive Blur Overlay */}
              <div
                ref={cinemaStageRef}
                onClick={() => setSelectedBlurId(null)}
                className="flex-1 min-h-[220px] md:min-h-[250px] flex items-center justify-center p-2 relative bg-slate-950 overflow-hidden"
              >
                {allVideoClips.length > 0 ? (
                  <div className="relative max-h-full max-w-full flex items-center justify-center">
                    {allVideoClips.map((clip) => {
                      const isCurrentActive = activePlayback?.clip.id === clip.id;
                      const isSelected = selectedClipId === clip.id;
                      const isVisible = isCurrentActive || (!activePlayback && isSelected);

                      return (
                        <video
                          key={clip.id}
                          ref={(el) => {
                            if (el) videoPlayersRef.current[clip.id] = el;
                            else delete videoPlayersRef.current[clip.id];
                          }}
                          onLoadedMetadata={(e) => {
                            const d = e.currentTarget.duration;
                            if (d && isFinite(d) && d > 0) {
                              setTracks((prevTracks) =>
                                prevTracks.map((t) => ({
                                  ...t,
                                  clips: t.clips.map((c) => {
                                    if (c.id === clip.id && (c.trimEnd === c.originalDuration || !c.originalDuration || c.originalDuration === 10 || c.originalDuration === 5)) {
                                      return { ...c, originalDuration: d, trimEnd: d };
                                    }
                                    return c;
                                  }),
                                }))
                              );
                            }
                          }}
                          src={clip.url}
                          preload="auto"
                          playsInline
                          muted={mutedMaster || clip.isMuted || clip.trackMuted}
                          className={`max-h-[calc(100vh-340px)] max-w-full rounded-[6px] shadow-md object-contain mx-auto border border-slate-800 pointer-events-none ${
                            isVisible ? "block" : "hidden"
                          }`}
                        />
                      );
                    })}

                    {/* Interactive Blur Masks rendered over video preview */}
                    {blurMasks.map((mask) => {
                      const isVisible = currentTime >= mask.timeStart && currentTime <= mask.timeEnd;
                      if (!isVisible) return null;
                      const isSelected = selectedBlurId === mask.id;
                      const radiusStyle = mask.shape === "circle" ? "9999px" : `${mask.borderRadius ?? 8}px`;

                      return (
                        <div
                          key={mask.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBlurId(mask.id);
                          }}
                          onMouseDown={(e) => handleBlurMouseDown(e, mask, "move")}
                          style={{
                            top: `${mask.y}%`,
                            left: `${mask.x}%`,
                            width: `${mask.width}%`,
                            height: `${mask.height}%`,
                            borderRadius: radiusStyle,
                            backdropFilter: `blur(${mask.blurAmount || 16}px)`,
                            WebkitBackdropFilter: `blur(${mask.blurAmount || 16}px)`,
                          }}
                          className={`absolute z-30 cursor-move transition-shadow flex items-center justify-center ${
                            isSelected
                              ? "border-2 border-dashed border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/30 shadow-xl"
                              : "border border-white/50 bg-white/10 hover:border-amber-400 shadow-md"
                          }`}
                        >
                          {isSelected && (
                            <>
                              {/* Top Drag & Info Pill */}
                              <div className="absolute -top-6.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-900/95 text-white rounded-[4px] text-[9px] font-medium flex items-center gap-1.5 shadow-md whitespace-nowrap pointer-events-none border border-slate-700">
                                <EyeOff className="h-2.5 w-2.5 text-amber-400" />
                                <span>{mask.name}</span>
                                <span className="font-mono text-amber-300 font-bold">({(mask.timeEnd - mask.timeStart).toFixed(1)}s)</span>
                              </div>

                              {/* 4 Corner Resize Handles */}
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "nw")}
                                title="Resize Top-Left"
                                className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                              />
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "ne")}
                                title="Resize Top-Right"
                                className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                              />
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "sw")}
                                title="Resize Bottom-Left"
                                className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                              />
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "se")}
                                title="Resize Bottom-Right"
                                className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-amber-500 rounded-full cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                              />

                              {/* 4 Edge Resize / Stretch Handles (Chauda / Lamba) */}
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "e")}
                                title="Stretch Width (Right)"
                                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-4 bg-white border-2 border-amber-500 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                              />
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "w")}
                                title="Stretch Width (Left)"
                                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-4 bg-white border-2 border-amber-500 rounded-full cursor-ew-resize shadow-md hover:scale-125 transition-transform"
                              />
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "s")}
                                title="Stretch Height (Bottom)"
                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-white border-2 border-amber-500 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                              />
                              <div
                                onMouseDown={(e) => handleBlurMouseDown(e, mask, "n")}
                                title="Stretch Height (Top)"
                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-2.5 bg-white border-2 border-amber-500 rounded-full cursor-ns-resize shadow-md hover:scale-125 transition-transform"
                              />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : activeMediaId ? (
                  <div className="relative max-h-full max-w-full flex items-center justify-center">
                    <video
                      src={files.find((f) => f.id === activeMediaId)?.url}
                      muted={mutedMaster}
                      playsInline
                      className="max-h-[calc(100vh-340px)] max-w-full rounded-[6px] shadow-md object-contain mx-auto border border-slate-800 pointer-events-none"
                    />
                  </div>
                ) : (
                  <div className="text-center p-4 text-slate-400">
                    <Film className="h-8 w-8 mx-auto mb-1.5 opacity-30 text-slate-500" />
                    <p className="text-xs font-medium text-slate-300 m-0">Drag a video from the Media Bin onto T1 / T2 / T3</p>
                  </div>
                )}

                {/* Floating Blur Mask Settings Bar when Mask is Selected */}
                {selectedBlurObj && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white border border-slate-700 rounded-[6px] shadow-xl px-3 py-1.5 flex items-center gap-3 z-40 max-w-[95%] overflow-x-auto"
                  >
                    {/* Shape Toggle */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateBlurMask(selectedBlurObj.id, { shape: "rect", borderRadius: selectedBlurObj.borderRadius === 999 ? 8 : (selectedBlurObj.borderRadius ?? 8) })}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          selectedBlurObj.shape === "rect" ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        Rectangle
                      </button>
                      <button
                        type="button"
                        onClick={() => updateBlurMask(selectedBlurObj.id, { shape: "circle", borderRadius: 999 })}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                          selectedBlurObj.shape === "circle" ? "bg-amber-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        Circle
                      </button>
                    </div>

                    <div className="w-[1px] h-4 bg-slate-700 shrink-0" />

                    {/* Border Radius Control (Corner Roundness) */}
                    {selectedBlurObj.shape === "rect" && (
                      <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                        <span className="text-slate-400">Radius:</span>
                        <input
                          type="range"
                          min="0"
                          max="40"
                          value={selectedBlurObj.borderRadius ?? 8}
                          onChange={(e) => updateBlurMask(selectedBlurObj.id, { borderRadius: Number(e.target.value) })}
                          className="w-14 h-1 accent-amber-500 rounded cursor-pointer"
                        />
                        <span className="font-mono text-slate-300 w-6 text-right">{selectedBlurObj.borderRadius ?? 8}px</span>
                      </div>
                    )}

                    <div className="w-[1px] h-4 bg-slate-700 shrink-0" />

                    {/* Blur Intensity */}
                    <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                      <span className="text-slate-400">Blur:</span>
                      <input
                        type="range"
                        min="4"
                        max="35"
                        value={selectedBlurObj.blurAmount || 16}
                        onChange={(e) => updateBlurMask(selectedBlurObj.id, { blurAmount: Number(e.target.value) })}
                        className="w-14 h-1 accent-amber-500 rounded cursor-pointer"
                      />
                      <span className="font-mono text-slate-300 w-6 text-right">{selectedBlurObj.blurAmount || 16}px</span>
                    </div>

                    <div className="w-[1px] h-4 bg-slate-700 shrink-0" />

                    {/* Timeline Timing Display */}
                    <div className="text-[10px] text-amber-300 font-mono shrink-0">
                      <span>{formatTime(selectedBlurObj.timeStart)}</span>
                      <span> - </span>
                      <span>{formatTime(selectedBlurObj.timeEnd)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateBlurMask(selectedBlurObj.id, { timeStart: 0, timeEnd: Math.round(totalTimelineDuration) })}
                      title="Apply blur to entire video"
                      className="text-[10px] text-slate-300 hover:text-white underline cursor-pointer shrink-0"
                    >
                      All Time
                    </button>

                    <button
                      type="button"
                      onClick={(e) => deleteBlurMask(selectedBlurObj.id, e)}
                      title="Delete Blur Mask"
                      className="h-5 w-5 inline-flex items-center justify-center rounded text-rose-400 hover:bg-rose-950/80 hover:text-rose-200 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Minimal Player Transport Bar */}
              <div className="h-9 px-3 bg-slate-50 border-t border-b border-slate-200 flex items-center justify-between shrink-0">
                {/* Timecode */}
                <div className="text-[11px] font-mono text-slate-700 font-medium min-w-[100px]">
                  {formatTime(currentTime)} <span className="text-slate-400 font-normal text-[10px]">/ {formatTime(totalTimelineDuration)}</span>
                </div>

                {/* Center Transport Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime - 5)}
                    title="Rewind 5s"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Rewind className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePlay}
                    title={isPlaying ? "Pause (Space)" : "Play (Space)"}
                    className="h-7 px-3 inline-flex items-center justify-center gap-1 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-medium shadow-xs border border-slate-700 transition-colors cursor-pointer"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-white ml-0.5" />}
                    <span>{isPlaying ? "Pause" : "Play"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => seekTo(currentTime + 5)}
                    title="Fast Forward 5s"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
                  >
                    <FastForward className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Right Transport Mute & Fullscreen */}
                <div className="flex items-center gap-1 min-w-[100px] justify-end">
                  <button
                    type="button"
                    onClick={() => setMutedMaster((m) => !m)}
                    title={mutedMaster ? "Unmute Master" : "Mute Master"}
                    className={`h-7 w-7 inline-flex items-center justify-center rounded-[6px] border shadow-2xs transition-colors cursor-pointer ${
                      mutedMaster || activeClipMuted
                        ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {mutedMaster || activeClipMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => videoRef.current?.requestFullscreen?.()}
                    title="Fullscreen"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Comprehensive Studio Toolbar */}
              <div className="h-8 px-2.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1">
                  {/* Undo Button */}
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    title="Undo (Ctrl+Z)"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>

                  {/* Redo Button */}
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoHistory.length === 0}
                    title="Redo (Ctrl+Y)"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

                  {/* Split Video Button */}
                  <button
                    type="button"
                    onClick={splitCurrentClip}
                    disabled={tracks.flatMap((t) => t.clips).length === 0}
                    title="Split Video at Cursor / Playhead (S)"
                    className="h-6 px-2 inline-flex items-center gap-1 rounded-[6px] border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 shadow-2xs transition-colors cursor-pointer text-[11px] font-medium disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    <span>Split</span>
                  </button>


                  {/* Delete Selected Clip Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTrackId && selectedClipId) {
                        deleteClip(selectedTrackId, selectedClipId);
                      } else if (selectedBlurId) {
                        deleteBlurMask(selectedBlurId);
                      }
                    }}
                    disabled={!selectedClipId && !selectedBlurId}
                    title="Delete Selected Clip (Delete / Backspace)"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>


                  {/* Mute Voice / Remove Audio Button */}
                  <button
                    type="button"
                    onClick={() => currentSelectedClip && toggleClipMute(selectedTrackId, selectedClipId)}
                    disabled={!selectedClipId}
                    title={activeClipMuted ? "Unmute Voice" : "Remove Voice / Mute Clip"}
                    className={`h-6 w-6 inline-flex items-center justify-center rounded-[6px] border shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                      activeClipMuted
                        ? "bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100"
                        : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {activeClipMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  </button>

                  {/* Duplicate Clip Button */}
                  <button
                    type="button"
                    onClick={() => currentSelectedClip && duplicateClip(selectedTrackId, selectedClipId)}
                    disabled={!selectedClipId}
                    title="Duplicate Clip"
                    className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>

                  <div className="w-[1px] h-4 bg-slate-200 mx-0.5" />

                  {/* Add Blur Mask Button */}
                  <button
                    type="button"
                    onClick={() => addBlurMask("rect")}
                    title="Add Blur Redaction Area"
                    className="h-6 px-2 inline-flex items-center gap-1 rounded-[6px] border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                  >
                    <EyeOff className="h-3 w-3 text-indigo-600" />
                    <span>Blur Area</span>
                  </button>

                  {/* Magnetic Snapping Toggle */}
                  <button
                    type="button"
                    onClick={() => setSnappingEnabled((s) => !s)}
                    title={snappingEnabled ? "Magnetic Snapping Active (Auto-align clips)" : "Enable Magnetic Snapping"}
                    className={`h-6 px-2 inline-flex items-center gap-1 rounded-[6px] border shadow-2xs text-[11px] font-medium transition-colors cursor-pointer ${
                      snappingEnabled
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold"
                        : "bg-white border-slate-300 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <Magnet className="h-3 w-3" />
                    <span>Snap</span>
                  </button>
                </div>

                {/* Right: Timeline Scale & Add Track */}
                <div className="flex items-center gap-1.5 text-slate-600">
                  {/* Timeline Scale & Granularity Controller */}
                  <div className="flex items-center gap-1 bg-slate-50 p-0.5 border border-slate-200 rounded-[6px]">
                    <span className="text-[9px] font-bold text-slate-500 uppercase px-1">Scale:</span>
                    <button
                      type="button"
                      onClick={() => setScaleStepIndex((i) => Math.min(SCALE_STEPS.length - 1, i + 1))}
                      disabled={scaleStepIndex === SCALE_STEPS.length - 1}
                      title="Contract Timeline View (Wider tick intervals: 2s, 3s, 5s, 10s...)"
                      className="h-5 w-5 rounded-[4px] bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-bold text-xs flex items-center justify-center shadow-2xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-[10px] font-mono font-bold px-1.5 text-slate-800 min-w-[34px] text-center bg-white border border-slate-200 rounded-[4px]">
                      {currentScale.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setScaleStepIndex((i) => Math.max(0, i - 1))}
                      disabled={scaleStepIndex === 0}
                      title="Expand Timeline View (Finer tick intervals: 1s, 0.5s, 0.1s...)"
                      className="h-5 w-5 rounded-[4px] bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-bold text-xs flex items-center justify-center shadow-2xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-[1px] h-4 bg-slate-200" />

                  {/* Hidden Audio File Input */}
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/mp3,audio/*,.mp3,.wav,.aac,.m4a,.ogg"
                    multiple
                    className="hidden"
                    onChange={handleAudioTrackUpload}
                  />

                  {/* Add Track (Opens File Explorer for MP3 / Audio files) */}
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    title="Add Audio Track (Opens File Explorer for MP3 files)"
                    className="h-6 px-2 inline-flex items-center gap-1 rounded-[6px] border border-slate-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Music className="h-3 w-3 text-indigo-600" />
                    <span>+ Track</span>
                  </button>
                </div>
              </div>

              {/* 3. Multi-Track Timeline (T1, T2, T3) with Snapping & Horizontal Scroll */}
              <div
                ref={timelineTracksRef}
                className="h-44 bg-slate-50 flex flex-col shrink-0 select-none overflow-hidden"
              >
                {/* Horizontal Scrollable Timeline Area */}
                <div
                  ref={timelineScrollRef}
                  className="flex-1 flex flex-col overflow-x-auto overflow-y-auto"
                >
                  <div
                    style={{
                      minWidth: `${Math.max(100, (totalTimelineDuration * currentScale.pxPerSec) / 8)}%`,
                      width: "100%",
                    }}
                    className="flex flex-col flex-1"
                  >
                    {/* Timeline Ruler */}
                    <div
                      onMouseDown={handleRulerMouseDown}
                      onClick={handleTimelineRulerClick}
                      className="h-5 bg-slate-100 border-b border-slate-200 flex items-center relative cursor-pointer shrink-0 select-none overflow-hidden"
                    >

                      <div className="w-[50px] text-[9px] font-bold text-slate-500 uppercase px-1.5 shrink-0 border-r border-slate-200">
                        TRACKS
                      </div>
                      <div data-track-lane="true" className="flex-1 relative h-full flex items-center">
                        {/* Dynamic Ruler Ticks based on selected interval (0.1s, 0.5s, 1s, 2s, 3s, 5s, 10s...) */}
                        {Array.from({ length: Math.min(350, Math.floor(totalTimelineDuration / currentScale.interval) + 1) }).map((_, i) => {
                          const tickTime = i * currentScale.interval;
                          if (tickTime > totalTimelineDuration + 0.001) return null;
                          const leftPct = (tickTime / (totalTimelineDuration || 1)) * 100;
                          
                          let label = "";
                          let isMajor = false;
                          if (currentScale.interval < 1) {
                            label = `${tickTime.toFixed(1)}s`;
                            isMajor = Math.round(tickTime * 10) % 10 === 0;
                          } else if (currentScale.interval >= 60) {
                            const m = Math.floor(tickTime / 60);
                            const s = Math.floor(tickTime % 60);
                            label = s > 0 ? `${m}m ${s}s` : `${m}m`;
                            isMajor = true;
                          } else {
                            const m = Math.floor(tickTime / 60);
                            const s = Math.floor(tickTime % 60);
                            label = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
                            isMajor = true;
                          }

                          return (
                            <div
                              key={i}
                              className={`absolute font-mono pl-0.5 pointer-events-none select-none flex flex-col justify-end ${
                                isMajor
                                  ? "text-[8.5px] font-semibold text-slate-600 border-l border-slate-400 h-3.5 top-0.5"
                                  : "text-[7.5px] text-slate-400 border-l border-slate-200 h-2 top-2"
                              }`}
                              style={{ left: `${leftPct}%` }}
                            >
                              <span className="leading-none">{label}</span>
                            </div>
                          );
                        })}
                        {/* Master White Scrub Needle Head */}
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-white z-40 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,1)] will-change-[left] transition-none"
                          style={{
                            left: `${(currentTime / (totalTimelineDuration || 1)) * 100}%`,
                          }}
                        >
                          <div className="w-3 h-3 bg-white rounded-[3px] -translate-x-[5px] -translate-y-0.5 shadow-md border border-slate-900 flex items-center justify-center">
                            <div className="w-1 h-1 bg-indigo-600 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Track Rows (T1, T2, T3, A1, A2) */}
                    <div className="flex-1 px-0 py-1 space-y-1 relative">

                      {/* Single Unified Full-Height Master Playhead Line across all tracks */}
                      <div className="absolute inset-y-0 left-[50px] right-0 pointer-events-none z-40 overflow-visible">
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-white -translate-x-[1px] shadow-[0_0_10px_rgba(255,255,255,1)] pointer-events-none transition-none will-change-[left]"
                          style={{
                            left: `${(currentTime / (totalTimelineDuration || 1)) * 100}%`,
                          }}
                        />
                      </div>

                      {/* Full-Height Cross-Track Magnetic Snap Guide Line */}
                      {snapGuide && (
                        <div className="absolute inset-y-0 left-[50px] right-0 pointer-events-none z-50">
                          <div
                            style={{ left: `${snapGuide.leftPct}%` }}
                            className="absolute top-0 bottom-0 w-[2.5px] bg-cyan-400 -translate-x-[1px] shadow-[0_0_14px_rgba(34,211,238,1)] flex flex-col items-center"
                          >
                            <div className="absolute top-0.5 -translate-x-1/2 px-2 py-0.5 bg-cyan-400 text-slate-950 font-bold text-[9px] rounded-[4px] shadow-xl whitespace-nowrap border border-white/80 flex items-center gap-1 z-50">
                              <span>🧲</span>
                              <span>{snapGuide.label}</span>
                            </div>
                            <div className="absolute bottom-0 w-2.5 h-2.5 bg-cyan-400 rotate-45 -translate-y-0.5 shadow-md" />
                          </div>
                        </div>
                      )}

                      {/* Dedicated Blur Track Row (B1 Blur Layer) */}
                      {blurMasks.length > 0 && (
                        <div
                          className={`flex h-10 rounded-[6px] bg-white border cursor-pointer relative overflow-hidden shadow-2xs ${
                            selectedBlurId ? "border-amber-400 bg-amber-50/10" : "border-amber-200/80"
                          }`}
                        >
                          {/* Track Header (B1 Blur) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="w-[50px] bg-amber-50 px-1.5 py-0.5 border-r border-amber-200 flex items-center justify-between shrink-0 z-10"
                          >
                            <span className="text-[10px] font-bold text-amber-800 flex items-center gap-0.5">
                              <EyeOff className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                              <span>B1</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => addBlurMask()}
                              title="Add Another Blur Mask"
                              className="h-4.5 w-4.5 inline-flex items-center justify-center rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                            >
                              +
                            </button>
                          </div>

                          {/* Blur Timeline Lane */}
                          <div
                            data-track-lane="true"
                            onClick={(e) => {
                              const laneRect = e.currentTarget.getBoundingClientRect();
                              const clickRatio = Math.max(0, Math.min(1, (e.clientX - laneRect.left) / laneRect.width));
                              seekTo(clickRatio * totalTimelineDuration);
                            }}
                            className="flex-1 relative h-full bg-amber-50/20 min-w-0"
                          >
                            {/* Blur Mask Clips on Timeline */}
                            {blurMasks.map((mask) => {
                              const isSelected = selectedBlurId === mask.id;
                              const dur = Math.max(0.2, mask.timeEnd - mask.timeStart);
                              const leftPct = (mask.timeStart / (totalTimelineDuration || 1)) * 100;
                              const widthPct = (dur / (totalTimelineDuration || 1)) * 100;

                              return (
                                <div
                                  key={mask.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBlurId(mask.id);
                                  }}
                                  onMouseDown={(e) => handleBlurTimelineMouseDown(e, mask, "move")}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${Math.max(2, widthPct)}%`,
                                    minWidth: "36px",
                                  }}
                                  className={`absolute top-0.5 bottom-0.5 rounded-[6px] border flex items-center select-none cursor-grab active:cursor-grabbing transition-shadow group z-20 overflow-hidden ${
                                    isSelected
                                      ? "bg-amber-900 text-amber-100 border-amber-950 shadow-sm ring-1 ring-amber-400/50"
                                      : "bg-amber-100/90 text-amber-950 border-amber-300 hover:bg-amber-200/90"
                                  }`}
                                >
                                  {/* Left Corner Cut Handle (|◀) */}
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleBlurTimelineMouseDown(e, mask, "trim-start");
                                    }}
                                    title="Drag left edge to change when Blur starts"
                                    className="absolute left-0 top-0 bottom-0 w-3 bg-amber-400/50 hover:bg-amber-800 flex items-center justify-center cursor-col-resize z-30 transition-colors"
                                  >
                                    <div className="w-0.5 h-3 bg-white/90 rounded-full shadow-2xs" />
                                  </div>

                                  {/* Blur Clip Body Content */}
                                  <div className="flex-1 px-2.5 flex items-center justify-between min-w-0 pointer-events-none">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <EyeOff className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                                      <span className={`text-[10.5px] font-medium truncate ${isSelected ? "text-white" : "text-amber-950"}`}>
                                        {mask.name}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-1 pointer-events-auto">
                                      <span className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded-[4px] ${
                                        isSelected ? "bg-amber-950 text-amber-200" : "bg-white text-amber-900 border border-amber-200 font-medium"
                                      }`}>
                                        {formatTime(dur)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => deleteBlurMask(mask.id, e)}
                                        title="Delete Blur Mask"
                                        className="h-4 w-4 inline-flex items-center justify-center rounded-full text-amber-700 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Right Corner Cut Handle (▶|) */}
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleBlurTimelineMouseDown(e, mask, "trim-end");
                                    }}
                                    title="Drag right edge to change when Blur ends (Duration)"
                                    className="absolute right-0 top-0 bottom-0 w-3 bg-amber-400/50 hover:bg-amber-800 flex items-center justify-center cursor-col-resize z-30 transition-colors"
                                  >
                                    <div className="w-0.5 h-3 bg-white/90 rounded-full shadow-2xs" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {tracks.map((track) => (
                        <div
                          key={track.id}
                          data-track-id={track.id}
                          className={`flex h-11 rounded-[6px] bg-white border cursor-pointer relative overflow-hidden shadow-2xs ${
                            selectedTrackId === track.id ? "border-slate-400" : "border-slate-200"
                          } ${track.isAudio ? "border-emerald-200" : ""}`}
                        >
                          {/* Track Header (T1 / T2 / A1 Audio) */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className={`w-[50px] px-1.5 py-0.5 border-r border-slate-200 flex items-center justify-between shrink-0 z-10 ${
                              track.isAudio ? "bg-emerald-50" : "bg-slate-50"
                            }`}
                          >
                            <span className={`text-[10px] font-bold flex items-center gap-0.5 ${track.isAudio ? "text-emerald-700" : "text-slate-700"}`}>
                              {track.isAudio && <Music className="h-2.5 w-2.5 text-emerald-600 shrink-0" />}
                              <span>{track.name}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setTracks((prev) =>
                                  prev.map((t) => (t.id === track.id ? { ...t, muted: !t.muted } : t))
                                )
                              }
                              title={track.muted ? "Unmute Track" : "Mute Track Audio"}
                              className={`h-5 w-5 inline-flex items-center justify-center rounded-[6px] border shadow-2xs transition-colors cursor-pointer ${
                                track.muted ? "bg-rose-50 border-rose-300 text-rose-600" : "bg-white border-slate-300 text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              {track.muted ? <VolumeX className="h-2.5 w-2.5" /> : <Volume2 className="h-2.5 w-2.5" />}
                            </button>
                          </div>

                          {/* Track Timeline Lane */}
                          <div
                            data-track-id={track.id}
                            data-track-lane="true"
                            onClick={(e) => handleTrackLaneClick(e, track.id)}
                            onDragOver={(e) => handleTimelineDragOver(e, track.id)}
                            onDrop={(e) => handleTimelineDrop(e, track.id)}
                            className={`flex-1 relative h-full min-w-0 ${track.isAudio ? "bg-emerald-50/20" : "bg-slate-50/40"}`}
                          >
                            {/* Ghost Drop Placement Indicator */}
                            {ghostPlacement && ghostPlacement.trackId === track.id && (
                              <div
                                style={{
                                  left: `${ghostPlacement.leftPct}%`,
                                  width: `${Math.max(2, ghostPlacement.widthPct)}%`,
                                }}
                                className="absolute top-0.5 bottom-0.5 rounded-[6px] border-2 border-dashed border-cyan-400 bg-cyan-400/25 z-25 pointer-events-none flex items-center justify-center text-[9px] font-bold text-slate-900 shadow-md backdrop-blur-2xs"
                              >
                                <span className="bg-white/90 px-1.5 py-0.5 rounded text-[8px] font-bold text-cyan-900 shadow-xs">
                                  ✓ Snap Place Here
                                </span>
                              </div>
                            )}

                            {/* Clips on this track */}
                            {track.clips.map((clip) => {
                              const isSelected = selectedClipId === clip.id;
                              const clipDuration = Math.max(0.1, clip.trimEnd - clip.trimStart);
                              const leftPct = ((clip.startTime || 0) / (totalTimelineDuration || 1)) * 100;
                              const widthPct = (clipDuration / (totalTimelineDuration || 1)) * 100;

                              // Check if this clip seamlessly connects with any other clip in the project
                              const touchingClip = tracks.flatMap((t) => t.clips).find((other) => {
                                if (other.id === clip.id) return false;
                                const otherEnd = (other.startTime || 0) + (other.trimEnd - other.trimStart);
                                return Math.abs((clip.startTime || 0) - otherEnd) < 0.08;
                              });

                              const isAudioClip = clip.type === "audio" || track.isAudio;

                              return (
                                <div
                                  key={clip.id}
                                  onClick={(e) => handleClipClick(e, track.id, clip)}
                                  onMouseDown={(e) => handleClipMouseDown(e, track.id, clip, "move")}
                                  onContextMenu={(e) => openClipContextMenu(e, track.id, clip)}
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${Math.max(2, widthPct)}%`,
                                    minWidth: "36px",
                                  }}
                                  className={`absolute top-0.5 bottom-0.5 rounded-[6px] border flex items-center select-none cursor-grab active:cursor-grabbing transition-shadow group z-20 overflow-hidden ${
                                    isSelected
                                      ? (isAudioClip
                                          ? "bg-emerald-900 text-emerald-100 border-emerald-950 shadow-sm ring-1 ring-emerald-400/50"
                                          : "bg-slate-900 text-white border-slate-950 shadow-sm ring-1 ring-slate-400/50")
                                      : (isAudioClip
                                          ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100/80"
                                          : "bg-slate-100 text-slate-900 border-slate-300 hover:bg-slate-200/80")
                                  } ${touchingClip ? "border-l-3 border-l-emerald-500" : ""}`}
                                >
                                  {/* Joint Connection Indicator Line */}
                                  {touchingClip && (
                                    <div
                                      title={`Seamless transition after "${touchingClip.name}" (0s gap)`}
                                      className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 z-30 shadow-[0_0_6px_rgba(16,185,129,1)]"
                                    />
                                  )}

                                  {/* Left Corner Cut Handle (|◀) */}
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleClipMouseDown(e, track.id, clip, "trim-start");
                                    }}
                                    title="Drag left edge to cut / trim start"
                                    className="absolute left-0 top-0 bottom-0 w-3.5 bg-slate-400/40 hover:bg-slate-800 flex items-center justify-center cursor-col-resize z-30 transition-colors"
                                  >
                                    <div className="w-0.5 h-4 bg-white/90 rounded-full shadow-2xs" />
                                  </div>

                                  {/* Clip Body Content */}
                                  <div className="flex-1 px-3 flex items-center justify-between min-w-0 pointer-events-none">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {isAudioClip ? (
                                        <Music className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        clip.isMuted && <VolumeX className="h-2.5 w-2.5 text-rose-300 shrink-0" />
                                      )}
                                      <span className={`text-[11px] font-medium truncate ${isSelected ? "text-white" : (isAudioClip ? "text-emerald-950 font-semibold" : "text-slate-800")}`}>
                                        {clip.name}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 ml-1 pointer-events-auto">
                                      {touchingClip && (
                                        <span className="text-[8px] bg-emerald-600 text-white font-mono px-1 py-0.2 rounded font-bold" title="0s Gap Seamless Transition">
                                          🔗 0s
                                        </span>
                                      )}
                                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-[4px] ${
                                        isSelected
                                          ? (isAudioClip ? "bg-emerald-950 text-emerald-200" : "bg-slate-800 text-white")
                                          : (isAudioClip ? "bg-white text-emerald-900 border border-emerald-200 font-medium" : "bg-white text-slate-800 border border-slate-200 font-medium")
                                      }`}>
                                        {formatTime(clipDuration)}
                                      </span>
                                      {/* High Visibility Delete X Button */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          deleteClip(track.id, clip.id, e);
                                        }}
                                        title="Delete Clip (Delete / Backspace)"
                                        className="h-4.5 w-4.5 inline-flex items-center justify-center rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xs transition-transform hover:scale-110 cursor-pointer z-30 ml-0.5"
                                      >
                                        <X className="h-3 w-3 stroke-[2.5]" />
                                      </button>

                                    </div>
                                  </div>

                                  {/* Right Corner Cut Handle (▶|) */}
                                  <div
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleClipMouseDown(e, track.id, clip, "trim-end");
                                    }}
                                    title="Drag right edge to cut / trim end"
                                    className="absolute right-0 top-0 bottom-0 w-3.5 bg-slate-400/40 hover:bg-slate-800 flex items-center justify-center cursor-col-resize z-30 transition-colors"
                                  >
                                    <div className="w-0.5 h-4 bg-white/90 rounded-full shadow-2xs" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Fast Compressor Mode */
            <div className="flex-1 flex flex-col md:flex-row p-4 gap-4 overflow-y-auto">
              <div className="w-full md:w-80 space-y-3.5 shrink-0">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                  <div className="h-8 w-8 rounded-[6px] bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 shrink-0">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 m-0">Fast Video & Audio Compressor</h2>
                    <p className="text-[10px] text-slate-500 m-0">Convert to MP4, WebM, MOV, MKV, MP3, M4A</p>
                  </div>
                </div>

                {/* Selected File Details */}
                {files.find((f) => f.id === compressFileId) ? (
                  <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-300 space-y-0.5">
                    <div className="text-[11px] font-medium text-slate-800 break-words">
                      {files.find((f) => f.id === compressFileId)?.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 flex justify-between">
                      <span>Original Size:</span>
                      <span className="font-semibold text-slate-900">
                        {formatBytes(files.find((f) => f.id === compressFileId)?.size)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border border-dashed border-slate-300 rounded-[6px] text-center text-[11px] text-slate-500">
                    Select video from Media Bin
                  </div>
                )}

                {/* Output Format Selector */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Output Format</label>
                    <span className="text-[9px] text-slate-900 font-semibold">{FORMAT_OPTIONS.find((f) => f.id === compressFormat)?.tag}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {FORMAT_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setCompressFormat(f.id)}
                        title={f.desc}
                        className={`p-2 rounded-[6px] border text-center transition-all cursor-pointer ${
                          compressFormat === f.id
                            ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-2xs"
                        }`}
                      >
                        <div className="text-[11px] font-medium">{f.label}</div>
                        <div className={`text-[8px] leading-tight ${compressFormat === f.id ? "text-slate-300" : "text-slate-400"}`}>
                          {f.tag}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resolution Selector */}
                {FORMAT_OPTIONS.find((f) => f.id === compressFormat)?.type === "video" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Resolution</label>
                    <div className="grid grid-cols-5 gap-1">
                      {RESOLUTION_OPTIONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setCompressResolution(r.id)}
                          className={`p-1.5 rounded-[6px] border text-center transition-all cursor-pointer ${
                            compressResolution === r.id
                              ? "bg-slate-900 border-slate-700 text-white font-semibold shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                          }`}
                        >
                          <div className="text-[10px]">{r.label.split(" ")[0]}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quality Presets */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Target Size Preset</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {QUALITY_PRESETS.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setCompressQuality(q.id);
                          setCustomTargetMB("");
                        }}
                        className={`p-2 rounded-[6px] border text-center transition-all cursor-pointer ${
                          compressQuality === q.id && !customTargetMB
                            ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                        }`}
                      >
                        <div className="text-[11px] leading-tight">{q.label}</div>
                        <div className={`text-[9px] mt-0.5 ${compressQuality === q.id && !customTargetMB ? "text-slate-300" : "text-slate-400"}`}>
                          {q.sub}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Target Size (MB) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Or Set Exact Size (MB)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 30"
                      value={customTargetMB}
                      onChange={(e) => setCustomTargetMB(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-[6px] p-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-500 shadow-2xs"
                    />
                    <span className="text-[11px] font-mono text-slate-500 font-semibold">MB</span>
                  </div>
                </div>

                {/* Voice / Audio Removal Option */}
                {FORMAT_OPTIONS.find((f) => f.id === compressFormat)?.type === "video" && (
                  <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <VolumeX className="h-4 w-4 text-rose-600" />
                      <div>
                        <div className="text-[11px] font-semibold text-slate-800 leading-tight">Remove Audio</div>
                        <div className="text-[9px] text-slate-500 leading-tight">Export silent video</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={compressStripAudio}
                      onChange={(e) => setCompressStripAudio(e.target.checked)}
                      className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                    />
                  </div>
                )}

                {/* Progress Bar */}
                {compressing && (
                  <div className="space-y-1.5 p-2.5 bg-slate-100 border border-slate-300 rounded-[6px]">
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-800" /> Compressing…
                      </span>
                      <span className="font-mono">{compressProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-900 h-full transition-all duration-150"
                        style={{ width: `${compressProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {compressError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-700 text-xs rounded-[6px] flex gap-1.5">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{compressError}</span>
                  </div>
                )}

                {/* Compress Button */}
                <button
                  type="button"
                  onClick={runCompression}
                  disabled={compressing || files.length === 0}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-[6px] text-xs font-medium flex items-center justify-center gap-2 shadow-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{compressing ? "Encoding…" : `Convert & Export as ${FORMAT_OPTIONS.find((f) => f.id === compressFormat)?.label}`}</span>
                </button>
              </div>

              {/* Right Result Output Card */}
              <div className="flex-1 bg-white border border-slate-200 rounded-[6px] p-5 flex flex-col items-center justify-center shadow-xs">
                {compressResult ? (
                  <div className="max-w-sm w-full space-y-3.5 text-center">
                    <div className="h-12 w-12 bg-slate-100 text-slate-900 rounded-full mx-auto flex items-center justify-center border border-slate-300">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">Conversion & Compression Complete!</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        File size reduced by <span className="font-semibold text-slate-900">~{compressResult.reductionPct}%</span>
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-300 text-[11px] font-mono space-y-1.5 text-left">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Original Size:</span>
                        <span className="text-slate-800 font-semibold">{formatBytes(compressResult.originalSize)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>Output Size:</span>
                        <span>{formatBytes(compressResult.size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Format / Codec:</span>
                        <span className="text-slate-800 font-semibold">{compressResult.format} ({compressResult.type.toUpperCase()})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Resolution:</span>
                        <span className="text-slate-800 font-semibold">{compressResult.resolution}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Audio Track:</span>
                        <span className="text-slate-800 font-semibold">{compressResult.hasAudio ? "Preserved" : "Removed"}</span>
                      </div>
                    </div>

                    {/* Preview Player */}
                    <div className="rounded-[6px] overflow-hidden border border-slate-300 bg-black">
                      {compressResult.type === "audio" ? (
                        <div className="p-4 bg-slate-900 flex flex-col items-center justify-center gap-2">
                          <Music className="h-8 w-8 text-slate-300" />
                          <audio src={compressResult.url} controls className="w-full" />
                        </div>
                      ) : (
                        <video src={compressResult.url} controls className="w-full max-h-44 object-contain" />
                      )}
                    </div>

                    {/* Download Button */}
                    <a
                      href={compressResult.url}
                      download={compressResult.name}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-xs font-medium flex items-center justify-center gap-2 text-decoration-none shadow-xs border border-slate-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download {compressResult.format} File</span>
                    </a>
                  </div>
                ) : (
                  <div className="text-center p-6 text-slate-400 space-y-2">
                    <FileVideo className="h-10 w-10 mx-auto text-slate-300" />
                    <p className="text-xs font-medium text-slate-700 m-0">Choose format (MP4, WebM, MOV, MKV, AVI, MP3, M4A)</p>
                    <p className="text-[10px] text-slate-400 max-w-xs m-0">
                      Configure target MB or resolution and click Convert & Export.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Comprehensive Project Export Modal */}
      {/* Clip Context Menu (Cut Range) */}
      {clipContextMenu.visible && (
        <div
          style={{
            left: Math.max(8, clipContextMenu.x + 6),
            top: clipContextMenu.showAbove ? Math.max(8, clipContextMenu.y - 170) : clipContextMenu.y + 6,
          }}
          className="fixed z-60 bg-white border border-slate-200 rounded p-3 shadow-xl w-72 text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-semibold mb-2">Cut Range (timeline)</div>
          <div className="mb-2 flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-slate-600">From</label>
              <input
                value={clipContextMenu.from}
                onChange={(e) => setClipContextMenu((s) => ({ ...s, from: e.target.value }))}
                className="w-full mt-1 p-1 border rounded text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-slate-600">To</label>
              <input
                value={clipContextMenu.to}
                onChange={(e) => setClipContextMenu((s) => ({ ...s, to: e.target.value }))}
                className="w-full mt-1 p-1 border rounded text-xs"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                const fromSec = parseTimeString(clipContextMenu.from);
                const toSec = parseTimeString(clipContextMenu.to);
                keepOnlyRange(clipContextMenu.trackId, clipContextMenu.clipId, fromSec, toSec);
              }}
              className="flex-1 py-1 bg-emerald-600 text-white rounded text-sm"
            >
              Keep Only
            </button>
            <button
              type="button"
              onClick={() => {
                const fromSec = parseTimeString(clipContextMenu.from);
                const toSec = parseTimeString(clipContextMenu.to);
                cutClipRange(clipContextMenu.trackId, clipContextMenu.clipId, fromSec, toSec);
              }}
              className="flex-1 py-1 bg-amber-600 text-white rounded text-sm"
            >
              Remove Range
            </button>
            <button
              type="button"
              onClick={() => setClipContextMenu((s) => ({ ...s, visible: false }))}
              className="py-1 px-3 bg-slate-100 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-[8px] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-[6px] bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 m-0">Export Timeline Video</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !exporting && setIsExportOpen(false)}
                className="h-6 w-6 inline-flex items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {exportResult ? (
                /* Export Success Screen */
                <div className="text-center space-y-3 py-2">
                  <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full mx-auto flex items-center justify-center border border-emerald-200">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 m-0">Video Rendered Successfully!</h4>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-[6px] border border-slate-300 text-left font-mono text-[11px] space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">File Name:</span>
                      <span className="text-slate-900 font-semibold truncate max-w-[200px]">{exportResult.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Format / Frame:</span>
                      <span className="text-slate-900 font-semibold">{exportResult.format} ({exportResult.aspect})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resolution:</span>
                      <span className="text-slate-900 font-semibold">{exportResult.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">File Size:</span>
                      <span className="text-slate-900 font-semibold">{formatBytes(exportResult.size)}</span>
                    </div>
                  </div>

                  {/* Video Player */}
                  <div className="rounded-[6px] overflow-hidden border border-slate-300 bg-black max-h-48 flex items-center justify-center">
                    <video src={exportResult.url} controls className="w-full max-h-48 object-contain" />
                  </div>

                  {/* Download Action */}
                  <a
                    href={exportResult.url}
                    download={exportResult.name}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[6px] font-semibold flex items-center justify-center gap-2 text-decoration-none shadow-xs border border-indigo-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download {exportResult.format} Video</span>
                  </a>
                </div>
              ) : (
                /* Export Settings Form */
                <>
                  {/* 1. Frame / Aspect Ratio */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Aspect Ratio & Frame Size
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {exportAspectRatios.map((item) => {
                        const Icon = item.icon;
                        const isSel = exportAspect === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setExportAspect(item.id)}
                            className={`p-2 rounded-[6px] border text-left transition-all cursor-pointer ${
                              isSel
                                ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-2xs"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className="h-3.5 w-3.5" />
                              <span className="text-[11px]">{item.label}</span>
                            </div>
                            <div className={`text-[9px] leading-tight ${isSel ? "text-slate-300" : "text-slate-400"}`}>
                              {item.sub}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Output Format */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Video Format
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: "mp4", label: "MP4 (H.264)", sub: "Universal" },
                        { id: "webm", label: "WebM (VP9)", sub: "Web/Streaming" },
                        { id: "mov", label: "MOV", sub: "QuickTime" },
                        { id: "mp3", label: "MP3 Audio", sub: "Soundtrack" },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setExportFormat(f.id)}
                          className={`p-2 rounded-[6px] border text-center transition-all cursor-pointer ${
                            exportFormat === f.id
                              ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-2xs"
                          }`}
                        >
                          <div className="text-[11px] font-medium">{f.label}</div>
                          <div className={`text-[8px] ${exportFormat === f.id ? "text-slate-300" : "text-slate-400"}`}>{f.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Resolution & Framerate (FPS) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Resolution</label>
                      <select
                        value={exportResolution}
                        onChange={(e) => setExportResolution(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-[6px] p-2 text-xs text-slate-900 focus:outline-none focus:border-slate-500 shadow-2xs cursor-pointer"
                      >
                        <option value="1080p">1080p Full HD (Crisp / High Quality)</option>
                        <option value="720p">720p HD (Balanced)</option>
                        <option value="480p">480p SD (Fast / Compact)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Framerate (FPS)</label>
                      <select
                        value={exportFps}
                        onChange={(e) => setExportFps(Number(e.target.value))}
                        className="w-full bg-white border border-slate-300 rounded-[6px] p-2 text-xs text-slate-900 focus:outline-none focus:border-slate-500 shadow-2xs cursor-pointer"
                      >
                        <option value="60">60 FPS (Ultra Smooth)</option>
                        <option value="30">30 FPS (Standard Web)</option>
                        <option value="24">24 FPS (Cinematic)</option>
                      </select>
                    </div>
                  </div>

                  {/* 4. Export Duration Selector */}
                  <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-300 rounded-[6px]">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Export Duration
                      </label>
                      <span className="text-[11px] font-mono font-bold text-indigo-700">
                        ⏱ {formatTime(effectiveExportDuration)} ({Math.round(effectiveExportDuration)}s)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExportDurationMode("video")}
                        className={`p-1.5 rounded-[6px] border text-left cursor-pointer transition-all ${
                          exportDurationMode === "video"
                            ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-[10px] font-medium">Video Content</div>
                        <div className={`text-[8px] ${exportDurationMode === "video" ? "text-slate-300" : "text-slate-500"}`}>
                          {formatTime(videoClipsMaxEnd || calculatedMaxEnd)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExportDurationMode("all")}
                        className={`p-1.5 rounded-[6px] border text-left cursor-pointer transition-all ${
                          exportDurationMode === "all"
                            ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-[10px] font-medium">Full Timeline</div>
                        <div className={`text-[8px] ${exportDurationMode === "all" ? "text-slate-300" : "text-slate-500"}`}>
                          {formatTime(calculatedMaxEnd)}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExportDurationMode("custom")}
                        className={`p-1.5 rounded-[6px] border text-left cursor-pointer transition-all ${
                          exportDurationMode === "custom"
                            ? "bg-slate-900 text-white border-slate-700 font-semibold shadow-xs"
                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        <div className="text-[10px] font-medium">Custom Range</div>
                        <div className={`text-[8px] ${exportDurationMode === "custom" ? "text-slate-300" : "text-slate-500"}`}>
                          {exportCustomDuration ? `${exportCustomDuration}s` : "Set manual"}
                        </div>
                      </button>
                    </div>

                    {exportDurationMode === "custom" && (
                      <div className="flex items-center gap-2 mt-1 pt-1 border-t border-slate-200">
                        <span className="text-[10px] text-slate-600 font-medium">Duration:</span>
                        <input
                          type="number"
                          min="1"
                          max="7200"
                          placeholder="Seconds (e.g. 154)"
                          value={exportCustomDuration}
                          onChange={(e) => setExportCustomDuration(e.target.value)}
                          className="flex-1 bg-white border border-slate-300 rounded p-1 text-xs text-slate-900 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({formatTime(Number(exportCustomDuration) || 0)})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 5. Blur Mask Summary */}
                  {blurMasks.length > 0 && (
                    <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-[6px] flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <EyeOff className="h-3.5 w-3.5 text-indigo-600" />
                        <span className="font-semibold text-indigo-900">Blur Masks:</span>{" "}
                        <span className="text-indigo-700">{blurMasks.length} active redactions</span>
                      </div>
                    </div>
                  )}

                  {/* Live Render & Progress Stage */}
                  {exporting && (
                    <div className="space-y-2 p-3 bg-slate-900 text-white rounded-[8px] border border-slate-800 shadow-md">
                      <div className="flex items-center justify-between font-medium text-xs">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" /> Rendering Video Live…
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {exportProgress}% ({formatTime(exportRenderTime)} / {formatTime(effectiveExportDuration)})
                        </span>
                      </div>

                      {/* Live Canvas Preview */}
                      <div className="rounded-[6px] overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center relative shadow-inner">
                        <canvas
                          ref={exportPreviewCanvasRef}
                          width={480}
                          height={270}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-1 left-2 bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-mono text-amber-300 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE ENCODER
                        </div>
                      </div>

                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-100"
                          style={{ width: `${exportProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Alert */}
                  {exportError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-700 rounded-[6px] flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>{exportError}</span>
                    </div>
                  )}

                  {/* Export Trigger Button */}
                  <button
                    type="button"
                    onClick={() => runProjectExport()}
                    disabled={exporting}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-[6px] font-semibold flex items-center justify-center gap-2 shadow-sm border border-slate-700 transition-colors cursor-pointer text-sm"
                  >
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>{exporting ? `Encoding Video (${formatTime(exportRenderTime)} / ${formatTime(effectiveExportDuration)})…` : `Export Full Video (${formatTime(effectiveExportDuration)})`}</span>
                  </button>


                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
