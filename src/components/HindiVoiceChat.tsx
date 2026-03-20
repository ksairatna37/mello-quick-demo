import { useState, useCallback, useEffect, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useRoomContext,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import Aurora from "@/components/ui/Aurora";
import ActionButton from "./ActionButton";
import type { VoiceLanguage } from "./VoiceChat";

interface HindiVoiceChatProps {
  onClose: () => void;
  onBack: () => void;
  language: VoiceLanguage;
  setLanguage: (lang: VoiceLanguage) => void;
}

type ConnectionData = {
  token: string;
  serverUrl: string;
  roomName: string;
  language: string;
};

const HindiVoiceChat = ({ onClose, onBack, language, setLanguage }: HindiVoiceChatProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionData, setConnectionData] = useState<ConnectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const connectHindiVoice = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      console.log("[HindiVoice] Requesting Hindi voice session...");

      const response = await fetch("/api/livekit-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: "hi-IN",
          userId: `user-${Date.now()}`,
          userName: "User",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to create voice session");
      }

      console.log("[HindiVoice] Voice session created:", data.roomName);

      setConnectionData({
        token: data.token,
        serverUrl: data.livekitUrl,
        roomName: data.roomName,
        language: data.language,
      });
    } catch (err) {
      console.error("[HindiVoice] Error connecting:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnectVoice = useCallback(() => {
    setConnectionData(null);
    setError(null);
    setSeconds(0);
    console.log("[HindiVoice] Disconnected");
  }, []);

  const handleBack = () => {
    disconnectVoice();
    onBack();
  };

  const handleClose = () => {
    disconnectVoice();
    onClose();
  };

  const isConnected = connectionData !== null;
  const showConnectButton = !isConnected;
  const timerText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="relative mx-auto flex min-h-[80vh] w-full flex-col overflow-hidden rounded-2xl bg-white p-2 sm:min-h-[84vh] sm:min-w-4xl sm:max-w-4xl sm:p-0">
      <div className="shrink-0 px-1 pt-1 sm:px-3 sm:pt-3">
        <Button onClick={handleBack} variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3 pt-2 sm:px-8 sm:pb-5">
        <div className="shrink-0 pb-3 text-center text-base font-medium text-gray-700 sm:pb-2 sm:text-lg">{timerText}</div>

        {isConnected && connectionData ? (
          <LiveKitRoom
            token={connectionData.token}
            serverUrl={connectionData.serverUrl}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={disconnectVoice}
            onError={(err) => {
              console.error("[HindiVoice] Room error:", err);
              setError(err.message);
            }}
          >
            <RoomAudioRenderer />
            <HindiVoiceUI
              seconds={seconds}
              setSeconds={setSeconds}
              error={error}
              onClose={handleClose}
            />
          </LiveKitRoom>
        ) : (
          <>
            <div className="flex shrink-0 justify-center">
              <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full sm:h-[220px] sm:w-[220px]">
                <div className="rotate-[3.35rad]">
                  <Aurora
                    colorStops={["#ff9933", "#ff9933", "#ff9933"]}
                    blend={0.5}
                    amplitude={0.45}
                    speed={0.35}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-1 flex-col justify-center">
              <div className="flex flex-1 items-center justify-center px-1 py-1">
                <div className="max-w-sm text-center sm:max-w-md lg:max-w-lg">
                  <div className="rounded-2xl py-2 text-gray-500">
                    <span className="handwriting-font">mello</span> Hindi voice
                    <br />
                    <span className="text-sm text-gray-400">Powered by Sarvam AI</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-1">
                {error && (
                  <div className="mx-auto max-w-md rounded-md bg-red-100 px-3 py-2 text-center text-sm text-red-600">
                    {error}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 flex shrink-0 flex-col items-center justify-center gap-3 border-t border-slate-100 bg-white/95 pt-3">
              {showConnectButton && (
                <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1">
                  <button
                    type="button"
                    onClick={() => setLanguage("english")}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      language === "english"
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage("hindi")}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                      language === "hindi"
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    Hindi
                  </button>
                </div>
              )}
              <Button
                onClick={() => void connectHindiVoice()}
                disabled={isConnecting}
                className="rounded-full bg-white px-6 text-gray-700 hover:bg-gray-100"
                variant="outline"
              >
                {isConnecting ? "Connecting..." : "Connect Voice"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface HindiVoiceUIProps {
  seconds: number;
  setSeconds: (fn: (s: number) => number) => void;
  error: string | null;
  onClose: () => void;
}

const HindiVoiceUI = ({ seconds, setSeconds, error, onClose }: HindiVoiceUIProps) => {
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { state: assistantState, audioTrack } = useVoiceAssistant();
  const [isMuted, setIsMuted] = useState(false);

  const isRoomConnected = connectionState === ConnectionState.Connected;
  const isRoomConnecting = connectionState === ConnectionState.Connecting;

  useEffect(() => {
    if (isRoomConnected) {
      const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isRoomConnected, setSeconds]);

  const toggleMute = useCallback(async () => {
    const localParticipant = room.localParticipant;
    if (isMuted) {
      await localParticipant.setMicrophoneEnabled(true);
      setIsMuted(false);
    } else {
      await localParticipant.setMicrophoneEnabled(false);
      setIsMuted(true);
    }
  }, [room, isMuted]);

  const handleEnd = useCallback(async () => {
    await room.disconnect();
    onClose();
  }, [room, onClose]);

  const isListening = assistantState === "listening" || (isRoomConnected && !assistantState);
  const isSpeaking = assistantState === "speaking";
  const amplitude = isSpeaking ? 1 : 0.45;

  const statusText = (() => {
    if (isRoomConnecting) return { main: "mello se ", highlight: "connect", suffix: " ho raha hai..." };
    if (isMuted) return { main: "Psst...", highlight: "unmute", suffix: " so mello can hear you" };
    if (assistantState === "thinking") return { main: "mello ", highlight: "soch rahi hai", suffix: "..." };
    if (isSpeaking) return { main: "mello ", highlight: "bol rahi hai", suffix: "" };
    return { main: "mello ", highlight: "sun rahi hai", suffix: " - bolo jo mann mein hai" };
  })();

  return (
    <>
      <div className="flex shrink-0 justify-center">
        <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full sm:h-[220px] sm:w-[220px]">
          <div className="rotate-[3.35rad]">
            <Aurora
              colorStops={["#ff9933", "#ff9933", "#ff9933"]}
              blend={0.5}
              amplitude={amplitude}
              speed={isSpeaking ? 2 : 0.35}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col justify-center">
        <div className="flex flex-1 items-center justify-center px-1 py-1">
          <div className="max-w-sm text-center sm:max-w-md lg:max-w-lg">
            <div className="rounded-2xl py-2 text-gray-500">
              {statusText.main}
              <span className={isMuted ? "text-red-500" : "text-[#ff9933]"}>{statusText.highlight}</span>
              {statusText.suffix}
            </div>
          </div>
        </div>

        <div className="shrink-0 pt-1">
          {error && (
            <div className="mx-auto max-w-md rounded-md bg-red-100 px-3 py-2 text-center text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mx-auto mt-2 w-fit rounded-full bg-orange-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-orange-700 sm:text-xs">
            {isRoomConnecting ? "connecting" : assistantState || "listening"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex shrink-0 flex-col items-center justify-center gap-3 border-t border-slate-100 bg-white/95 pt-3">
        <ActionButton
          type="button"
          variant={isMuted ? "outline" : "primary"}
          onClick={() => void toggleMute()}
          className="h-16 w-16 border border-solid border-[#cccac6] shadow-lg"
          icon={isMuted ? <MicOff className="h-8 w-8 text-red-500" /> : <Mic className="h-8 w-8 text-[#ff9933]" />}
        />
        <Button variant="outline" className="rounded-full" onClick={() => void handleEnd()}>
          End
        </Button>
      </div>
    </>
  );
};

export default HindiVoiceChat;
