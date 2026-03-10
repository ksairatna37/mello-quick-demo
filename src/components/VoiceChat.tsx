import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, RefreshCw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import Aurora from "@/components/ui/Aurora";
import ActionButton from "./ActionButton";

interface VoiceChatProps {
  onClose: () => void;
}

type VoiceUiState = "idle" | "connecting" | "listening" | "speaking" | "error";

type HumeEvent =
  | { type: "assistant_message"; message?: { content?: string } }
  | { type: "user_message"; message?: { content?: string } }
  | { type: "audio_output"; data: string }
  | { type: "assistant_end" }
  | { type: "user_interruption" }
  | { type: "error"; message?: string }
  | { type: string; [key: string]: unknown };

interface DemoMessage {
  id: string;
  text: string;
  isUser: boolean;
}

const VoiceChat = ({ onClose }: VoiceChatProps) => {
  const [uiState, setUiState] = useState<VoiceUiState>("idle");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [isMicEnabled, setIsMicEnabled] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const userMutedRef = useRef(false);
  const isMicEnabledRef = useRef(true);
  const hasInterruptedTurnRef = useRef(false);
  const closingRef = useRef(false);
  const uiStateRef = useRef<VoiceUiState>("idle");
  const mediaMimeTypeRef = useRef<string>("");
  const wsBaseUrl =
    import.meta.env.VITE_WS_BASE_URL?.replace(/\/+$/, "") ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

  useEffect(() => {
    if (["connecting", "listening", "speaking"].includes(uiState)) {
      const timer = setInterval(() => setSeconds((prev) => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [uiState]);

  useEffect(() => {
    isMicEnabledRef.current = isMicEnabled;
  }, [isMicEnabled]);

  useEffect(() => {
    return () => {
      cleanupSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestAIMessage = useMemo(() => {
    return [...messages].reverse().find((item) => !item.isUser);
  }, [messages]);

  const setSessionState = (state: VoiceUiState) => {
    uiStateRef.current = state;
    setUiState(state);
    if (state !== "error") {
      setErrorText(null);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const pauseMic = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
    }
  };

  const resumeMic = () => {
    if (userMutedRef.current) return;
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
    }
  };

  const stopAssistantAudioPlayback = () => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    if (activeSourceRef.current) {
      activeSourceRef.current.onended = null;
      activeSourceRef.current.stop();
      activeSourceRef.current.disconnect();
      activeSourceRef.current = null;
    }
  };

  const interruptAssistantForBargeIn = () => {
    if (uiStateRef.current !== "speaking" || hasInterruptedTurnRef.current) return;
    hasInterruptedTurnRef.current = true;
    stopAssistantAudioPlayback();
    setSessionState("listening");
    resumeMic();
  };

  const stopVadDetection = () => {
    if (vadRafRef.current !== null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (vadSourceRef.current) {
      vadSourceRef.current.disconnect();
      vadSourceRef.current = null;
    }
    if (vadAnalyserRef.current) {
      vadAnalyserRef.current.disconnect();
      vadAnalyserRef.current = null;
    }
  };

  const startVadDetection = async (stream: MediaStream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    stopVadDetection();

    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;

    const source = audioContextRef.current.createMediaStreamSource(stream);
    source.connect(analyser);

    vadAnalyserRef.current = analyser;
    vadSourceRef.current = source;

    const samples = new Float32Array(analyser.fftSize);
    let voiceFrames = 0;
    const threshold = 0.025;
    const requiredFrames = 4;

    const tick = () => {
      const currentAnalyser = vadAnalyserRef.current;
      if (!currentAnalyser) return;

      currentAnalyser.getFloatTimeDomainData(samples);
      let energy = 0;
      for (let i = 0; i < samples.length; i += 1) {
        energy += samples[i] * samples[i];
      }
      const rms = Math.sqrt(energy / samples.length);
      const canInterrupt = uiStateRef.current === "speaking" && isMicEnabledRef.current && !userMutedRef.current;

      if (canInterrupt && rms > threshold) {
        voiceFrames += 1;
        if (voiceFrames >= requiredFrames) {
          interruptAssistantForBargeIn();
          voiceFrames = 0;
        }
      } else {
        voiceFrames = 0;
      }

      vadRafRef.current = requestAnimationFrame(tick);
    };

    vadRafRef.current = requestAnimationFrame(tick);
  };

  const playNextAudio = () => {
    const audioContext = audioContextRef.current;
    if (!audioContext) return;

    const nextBuffer = audioQueueRef.current.shift();
    if (!nextBuffer) {
      isPlayingRef.current = false;
      activeSourceRef.current = null;
      if (uiStateRef.current !== "error") {
        setSessionState("listening");
      }
      resumeMic();
      return;
    }

    isPlayingRef.current = true;
    const src = audioContext.createBufferSource();
    activeSourceRef.current = src;
    src.buffer = nextBuffer;
    src.connect(audioContext.destination);
    src.onended = () => {
      activeSourceRef.current = null;
      playNextAudio();
    };
    src.start();
  };

  const enqueueAudio = async (base64Audio: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      const bytes = Uint8Array.from(atob(base64Audio), (ch) => ch.charCodeAt(0));
      const decoded = await audioContextRef.current.decodeAudioData(bytes.buffer);
      audioQueueRef.current.push(decoded);
      if (!isPlayingRef.current) {
        playNextAudio();
      }
    } catch {
      setSessionState("error");
      setErrorText("Audio playback failed. Please reconnect.");
    }
  };

  const handleHumeEvent = async (event: HumeEvent) => {
    switch (event.type) {
      case "assistant_message": {
        const text = event.message?.content?.trim();
        if (text) {
          setMessages((prev) => [...prev, { id: uuidv4(), text, isUser: false }]);
          hasInterruptedTurnRef.current = false;
          setSessionState("speaking");
          pauseMic();
        }
        break;
      }
      case "user_message": {
        const text = event.message?.content?.trim();
        if (text) {
          setMessages((prev) => [...prev, { id: uuidv4(), text, isUser: true }]);
        }
        break;
      }
      case "audio_output": {
        if (event.data) {
          await enqueueAudio(event.data);
        }
        break;
      }
      case "assistant_end": {
        if (!audioQueueRef.current.length && !isPlayingRef.current) {
          setSessionState("listening");
          resumeMic();
        }
        break;
      }
      case "user_interruption": {
        stopAssistantAudioPlayback();
        hasInterruptedTurnRef.current = true;
        setSessionState("listening");
        resumeMic();
        break;
      }
      case "error": {
        setSessionState("error");
        setErrorText(event.message || "Voice session error occurred.");
        break;
      }
      default:
        break;
    }
  };

  const startMicrophone = async () => {
    try {
      if (typeof MediaRecorder === "undefined") {
        setSessionState("error");
        setErrorText("This mobile browser does not support live mic streaming. Use Chrome on Android or desktop.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      await startVadDetection(stream);

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
        "audio/aac",
      ];
      const supportedMime = mimeCandidates.find((mime) => MediaRecorder.isTypeSupported(mime));
      mediaMimeTypeRef.current = supportedMime || "";

      const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async ({ data }) => {
        if (!data || data.size === 0) return;
        if (userMutedRef.current || uiStateRef.current === "speaking") return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const base64 = await blobToBase64(data);
        const payload: Record<string, string> = { type: "audio_input", data: base64 };
        if (mediaMimeTypeRef.current) {
          payload.mime_type = mediaMimeTypeRef.current;
        }
        wsRef.current.send(JSON.stringify(payload));
      };

      recorder.start(100);
    } catch (error) {
      setSessionState("error");
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("denied") || message.toLowerCase().includes("permission")) {
        setErrorText("Microphone access was denied. Please allow mic access and reconnect.");
      } else {
        setErrorText("Could not initialize microphone on this browser/device. Try Chrome on Android or desktop.");
      }
    }
  };

  const stopMicrophone = () => {
    stopVadDetection();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
  };

  const cleanupSession = () => {
    stopMicrophone();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
    stopAssistantAudioPlayback();
    stopVadDetection();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsMicEnabled(true);
    userMutedRef.current = false;
  };

  const connect = async () => {
    closingRef.current = false;
    setSeconds(0);
    setMessages([]);
    setSessionState("connecting");

    const ws = new WebSocket(`${wsBaseUrl}/ws/voice`);
    wsRef.current = ws;

    ws.onopen = async () => {
      await startMicrophone();
      if (mediaRecorderRef.current) {
        setSessionState("listening");
      }
    };

    ws.onmessage = async ({ data }) => {
      try {
        const event = JSON.parse(data) as HumeEvent;
        await handleHumeEvent(event);
      } catch {
        setSessionState("error");
        setErrorText("Received invalid response from voice service.");
      }
    };

    ws.onerror = () => {
      setSessionState("error");
      setErrorText("Could not connect to voice server. Check backend voice config and try again.");
    };

    ws.onclose = () => {
      stopMicrophone();
      if (!closingRef.current) {
        setSessionState("idle");
      }
    };
  };

  const disconnect = () => {
    closingRef.current = true;
    cleanupSession();
    setSessionState("idle");
    setSeconds(0);
  };

  const handleMicToggle = () => {
    if (!mediaRecorderRef.current) return;

    if (isMicEnabled) {
      userMutedRef.current = true;
      pauseMic();
      setIsMicEnabled(false);
    } else {
      userMutedRef.current = false;
      if (uiState !== "speaking") {
        resumeMic();
      }
      setIsMicEnabled(true);
    }
  };

  const handleBack = () => {
    disconnect();
    onClose();
  };

  const amplitude = uiState === "speaking" ? 1 : 0.45;
  const timerText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="mx-auto flex h-[80vh] w-full flex-col rounded-2xl bg-white p-2 sm:min-w-4xl sm:max-w-4xl sm:p-0">
      <Button onClick={handleBack} variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
        <ArrowLeft />
      </Button>

      <div className="flex flex-1 flex-col items-center justify-between overflow-hidden py-4">
        <div className="pb-4 text-lg font-medium text-gray-700">{timerText}</div>

        <div className="flex h-72 w-72 items-center justify-center overflow-hidden rounded-full sm:h-[250px] sm:w-[250px]">
          <div className="rotate-[3.35rad]">
            <Aurora
              colorStops={["#00eaff", "#00eaff", "#00eaff"]}
              blend={0.5}
              amplitude={amplitude}
              speed={uiState === "speaking" ? 2 : 0.35}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-1 items-center overflow-y-auto text-center">
          {!isMicEnabled && uiState !== "idle" ? (
            <div className="rounded-2xl py-2 text-gray-500">
              Psst... <span className="text-red-500">unmute</span> so <span className="handwriting-font">mello</span> can hear you
            </div>
          ) : latestAIMessage ? (
            <div className="max-w-[100%] rounded-xl p-2 text-left text-sm text-gray-800 sm:p-4 sm:text-base">{latestAIMessage.text}</div>
          ) : (
            <div className="rounded-2xl py-2 text-gray-500">
              <span className="handwriting-font">mello</span>
              <span className="text-[#758bfd]"> listening </span>
              so say what is on your mind
            </div>
          )}
        </div>

        {errorText && (
          <div className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-600">{errorText}</div>
        )}

        <div className="mb-4 mt-4 flex w-full items-center justify-center gap-3">
          {uiState === "idle" || uiState === "error" ? (
            <Button
              onClick={connect}
              disabled={uiState === "connecting"}
              className="rounded-full bg-white px-6 text-gray-700 hover:bg-gray-100"
              variant="outline"
            >
              {uiState === "connecting" ? "Connecting..." : "Connect Voice"}
            </Button>
          ) : (
            <>
              <ActionButton
                type="button"
                variant={isMicEnabled ? "primary" : "outline"}
                onClick={handleMicToggle}
                className="h-16 w-16 border border-solid border-[#cccac6] shadow-lg"
                icon={isMicEnabled ? <Mic className="h-8 w-8 text-[#758bfd]" /> : <MicOff className="h-8 w-8 text-red-500" />}
              />
              <Button variant="outline" className="rounded-full" onClick={disconnect}>
                End
              </Button>
            </>
          )}

          {uiState === "error" && (
            <Button variant="ghost" className="rounded-full" onClick={connect}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceChat;
