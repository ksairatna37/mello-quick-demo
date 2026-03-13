import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Aurora from "@/components/ui/Aurora";
import ActionButton from "./ActionButton";

interface VoiceChatProps {
  onClose: () => void;
}

type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "error";

const VoiceChat = ({ onClose }: VoiceChatProps) => {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);

  // Simple refs - like Python HTML
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const mediaDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const eviSpeakingRef = useRef(false);

  // iOS volume boost
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const IOS_GAIN = 2.5; // Boost volume on iOS

  // Timer
  useEffect(() => {
    if (state === "listening" || state === "speaking") {
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Audio Playback (fixed for immediate playback) ───
  const initAudioContext = async () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
    // Create GainNode for iOS volume boost
    if (!gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current = audioCtxRef.current.createGain();
      gainNodeRef.current.gain.value = isIOS ? IOS_GAIN : 1.0;
      // Route audio through a MediaStream destination and an HTMLAudioElement
      // This lets us call setSinkId (when available) to prefer the loudspeaker
      if (!mediaDestRef.current) {
        mediaDestRef.current = audioCtxRef.current.createMediaStreamDestination();
      }
      gainNodeRef.current.connect(mediaDestRef.current);

      // Create hidden audio element to play the MediaStream
      if (!audioElRef.current) {
        const a = document.createElement("audio");
        a.autoplay = true;
        try {
          // prefer inline playback on iOS
          (a as any).playsInline = true;
        } catch (e) {
          /* ignore */
        }
        a.style.display = "none";
        a.srcObject = mediaDestRef.current.stream;
        // Try to set sink ID to default (loudspeaker) when supported
        const setSink = (a as any).setSinkId || (a as any).webkitSetSinkId;
        if (setSink) {
          try {
            // 'default' is typically the speaker output; this may prompt permission in some browsers
            (a as any).setSinkId?.("default");
          } catch (e) {
            // ignore if not allowed
          }
        }
        document.body.appendChild(a);
        audioElRef.current = a;
      }
    }
  };

  const enqueueAudio = (b64: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      // Must copy buffer - decodeAudioData detaches the original
      const buffer = bytes.buffer.slice(0);

      ctx.decodeAudioData(buffer).then((decoded) => {
        audioQueueRef.current.push(decoded);
        if (!isPlayingRef.current) {
          playNext();
        }
      }).catch((e) => {
        console.warn("Audio decode error:", e);
      });
    } catch (e) {
      console.warn("Audio error:", e);
    }
  };

  const playNext = () => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      eviSpeakingRef.current = false;
      setState("listening");
      resumeMic();
      return;
    }

    isPlayingRef.current = true;
    eviSpeakingRef.current = true;

    const buffer = audioQueueRef.current.shift()!;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // Route through GainNode for volume control (iOS boost)
    // which is connected to a MediaStream destination + audio element
    src.connect(gainNodeRef.current || ctx.destination);
    src.onended = () => playNext();
    src.start(0);
  };

  // ─── Microphone (like Python HTML - no VAD) ───
  const startMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]
        .find((t) => MediaRecorder.isTypeSupported(t)) || "";

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = async ({ data }) => {
        if (!data || data.size === 0) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (eviSpeakingRef.current || muted) return; // Don't send while EVI speaking

        const b64 = await blobToBase64(data);
        wsRef.current.send(JSON.stringify({ type: "audio_input", data: b64 }));
      };

      recorder.start(100); // 100ms chunks
    } catch (e) {
      setError("Microphone access denied. Please allow and retry.");
      setState("error");
    }
  };

  const pauseMic = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
    }
  };

  const resumeMic = () => {
    if (!muted && recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
    }
  };

  const stopMic = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  };

  // ─── Handle Hume Messages (like Python HTML) ───
  const handleMessage = (msg: Record<string, unknown>) => {
    switch (msg.type) {
      case "user_message": {
        const text = (msg.message as { content?: string })?.content;
        if (text) setTranscript(text);
        break;
      }
      case "assistant_message": {
        const text = (msg.message as { content?: string })?.content;
        if (text) setTranscript(text);
        setState("speaking");
        pauseMic();
        break;
      }
      case "audio_output":
        enqueueAudio(msg.data as string);
        break;
      case "assistant_end":
        // Queue will drain via playNext()
        break;
      case "user_interruption":
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        eviSpeakingRef.current = false;
        setState("listening");
        resumeMic();
        break;
      case "error":
        setError((msg.message as string) || "Voice error occurred");
        setState("error");
        break;
    }
  };

  // ─── Connect DIRECTLY to Hume (like Python HTML) ───
  const connect = async () => {
    if (wsRef.current) return;

    setState("connecting");
    setError(null);
    setSeconds(0);
    setTranscript("");

    // Get credentials from server
    let apiKey = "";
    let configId = "";
    try {
      const resp = await fetch("/api/hume-token");
      const data = await resp.json();
      if (data.error) {
        setError(data.error);
        setState("error");
        return;
      }
      apiKey = data.api_key;
      configId = data.config_id || "";
    } catch {
      setError("Failed to get Hume credentials");
      setState("error");
      return;
    }

    // Connect directly to Hume (exactly like Python HTML)
    let wsUrl = `wss://api.hume.ai/v0/evi/chat?api_key=${encodeURIComponent(apiKey)}&evi_version=3`;
    if (configId) {
      wsUrl += `&config_id=${encodeURIComponent(configId)}`;
    }

    console.log("[Hume] Connecting directly to Hume EVI...");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = async () => {
      console.log("[Hume] Connected!");
      // Initialize AudioContext immediately (before audio arrives)
      await initAudioContext();
      setState("listening");
      await startMic();
    };

    ws.onmessage = ({ data }) => {
      try {
        handleMessage(JSON.parse(data));
      } catch (e) {
        console.error("Parse error:", e);
      }
    };

    ws.onerror = () => {
      console.error("[Hume] WebSocket error");
      setError("Connection failed. Check API key and retry.");
      setState("error");
    };

    ws.onclose = (e) => {
      console.log("[Hume] Disconnected:", e.code, e.reason);
      stopMic();
      if (state !== "error") setState("idle");
      wsRef.current = null;
    };
  };

  const disconnect = () => {
    stopMic();
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    eviSpeakingRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    // Cleanup audio
    try {
      gainNodeRef.current?.disconnect();
    } catch (e) {
      /* ignore */
    }
    gainNodeRef.current = null;

    // Remove and stop the audio element playing the MediaStream
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        // @ts-ignore
        audioElRef.current.srcObject = null;
        if (audioElRef.current.parentNode) audioElRef.current.parentNode.removeChild(audioElRef.current);
      } catch (e) {
        /* ignore */
      }
      audioElRef.current = null;
    }

    if (mediaDestRef.current) {
      try {
        mediaDestRef.current.stream.getTracks().forEach((t) => t.stop());
      } catch (e) {
        /* ignore */
      }
      mediaDestRef.current = null;
    }

    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setState("idle");
    setSeconds(0);
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      resumeMic();
    } else {
      setMuted(true);
      pauseMic();
    }
  };

  const handleBack = () => {
    disconnect();
    onClose();
  };

  const amplitude = state === "speaking" ? 1 : 0.45;
  const timerText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto flex h-[80vh] w-full flex-col rounded-2xl bg-white p-2 sm:min-w-4xl sm:max-w-4xl sm:p-0">
      <Button onClick={handleBack} variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
        <ArrowLeft />
      </Button>

      <div className="flex flex-1 flex-col items-center justify-between overflow-hidden py-4">
        <div className="sm:pb-4 pb-10 text-lg font-medium text-gray-700">{timerText}</div>

        <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-full sm:h-[250px] sm:w-[250px]">
          <div className="rotate-[3.35rad]">
            <Aurora
              colorStops={["#00eaff", "#00eaff", "#00eaff"]}
              blend={0.5}
              amplitude={amplitude}
              speed={state === "speaking" ? 2 : 0.35}
            />
          </div>
        </div>

        <div className="mt-4 flex w-full flex-1 items-center justify-center px-4 sm:px-8">
          <div className="max-w-sm text-center sm:max-w-md">
            {muted && state !== "idle" ? (
              <div className="rounded-2xl py-2 text-gray-500">
                Psst... <span className="text-red-500">unmute</span> so <span className="handwriting-font">mello</span> can hear you
              </div>
            ) : transcript ? (
              <div className="text-base leading-relaxed text-gray-800 sm:text-lg">{transcript}</div>
            ) : (
              <div className="rounded-2xl py-2 text-gray-500">
                <span className="handwriting-font">mello</span>
                <span className="text-[#758bfd]"> listening </span>
                so say what is on your mind
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-600">{error}</div>
        )}

        <div className="mb-4 mt-4 flex w-full items-center justify-center gap-3">
          {state === "idle" || state === "error" || state === "connecting" ? (
            <Button
              onClick={connect}
              disabled={state === "connecting"}
              className="rounded-full bg-white px-6 text-gray-700 hover:bg-gray-100"
              variant="outline"
            >
              {state === "connecting" ? "Connecting..." : "Connect Voice"}
            </Button>
          ) : (
            <>
              <ActionButton
                type="button"
                variant={muted ? "outline" : "primary"}
                onClick={toggleMute}
                className="h-16 w-16 border border-solid border-[#cccac6] shadow-lg"
                icon={muted ? <MicOff className="h-8 w-8 text-red-500" /> : <Mic className="h-8 w-8 text-[#758bfd]" />}
              />
              <Button variant="outline" className="rounded-full" onClick={handleBack}>
                End
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;
