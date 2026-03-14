import { useEffect, useRef, useState } from "react";
import { useVoice, VoiceReadyState } from "@humeai/voice-react";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { useHumeIntervention } from "@/components/HumeInterventionContext";
import { Button } from "@/components/ui/button";
import Aurora from "@/components/ui/Aurora";
import ActionButton from "./ActionButton";

interface VoiceChatProps {
  onClose: () => void;
}

type VoiceState = "idle" | "connecting" | "listening" | "speaking" | "error";

type HumeAuthResponse = {
  apiKey: string;
  configId?: string;
};

const VoiceChat = ({ onClose }: VoiceChatProps) => {
  const { currentIntervention } = useHumeIntervention();
  const {
    connect,
    disconnect,
    readyState,
    messages,
    isMuted,
    mute,
    unmute,
    isPlaying,
    clearMessages,
    error: voiceError,
    setVolume,
    isAudioMuted,
    unmuteAudio,
  } = useVoice();

  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [seconds, setSeconds] = useState(0);
  const lastTranscriptRef = useRef("");

  const pushDebug = (message: string) => {
    console.log(message);
  };

  console.log("[VoiceChat] render", {
    state,
    readyState,
    isPlaying,
    isMuted,
    messageCount: messages.length,
    hasError: Boolean(error || voiceError),
    seconds,
  });

  useEffect(() => {
    if (readyState === VoiceReadyState.OPEN) {
      setVolume(1);
      if (isAudioMuted) {
        unmuteAudio();
      }
      pushDebug("[VoiceChat] timer started");
      const timer = setInterval(() => setSeconds((current) => current + 1), 1000);
      return () => {
        pushDebug("[VoiceChat] timer stopped");
        clearInterval(timer);
      };
    }
  }, [isAudioMuted, readyState, setVolume, unmuteAudio]);

  useEffect(() => {
    pushDebug(
      `[VoiceChat] state ready=${readyState} playing=${String(isPlaying)} error=${voiceError?.message ?? "none"}`,
    );

    if (voiceError) {
      setError(voiceError.message);
      setState("error");
      return;
    }

    if (readyState === VoiceReadyState.CONNECTING) {
      setState("connecting");
      return;
    }

    if (readyState === VoiceReadyState.OPEN) {
      setState(isPlaying ? "speaking" : "listening");
      setError(null);
      return;
    }

    setState("idle");
  }, [isPlaying, readyState, voiceError]);

  useEffect(() => {
    if (readyState !== VoiceReadyState.OPEN) {
      pushDebug(`[VoiceChat] clearing transcript because readyState=${readyState}`);
      lastTranscriptRef.current = "";
      setTranscript("");
      setSeconds(0);
      return;
    }

    const assistantMessages = messages
      .filter(
        (message): message is (typeof messages)[number] & {
          type: "assistant_message";
          message: { content?: string };
        } => message.type === "assistant_message" && "message" in message,
      )
      .map((message) => message.message?.content?.trim() ?? "")
      .filter(Boolean);

    const latestTranscript = assistantMessages.at(-1) ?? "";

    if (latestTranscript === lastTranscriptRef.current) {
      return;
    }

    lastTranscriptRef.current = latestTranscript;
    pushDebug(`[VoiceChat] assistant transcript updated latest="${latestTranscript}"`);
    setTranscript(latestTranscript);
  }, [messages, readyState]);

  const connectVoice = async () => {
    pushDebug("[VoiceChat] connect clicked");
    setError(null);
    setTranscript("");
    setSeconds(0);
    clearMessages();

    let auth: HumeAuthResponse;
    try {
      pushDebug("[VoiceChat] requesting /api/hume-auth");
      const response = await fetch("/api/hume-auth");
      const data = (await response.json()) as HumeAuthResponse | { error?: string };
      pushDebug(
        `[VoiceChat] /api/hume-auth ok=${String(response.ok)} hasApiKey=${String(
          "apiKey" in data && Boolean(data.apiKey),
        )} configId=${"configId" in data ? (data.configId ?? "none") : "none"}`,
      );

      if (!response.ok || !("apiKey" in data) || !data.apiKey) {
        throw new Error(("error" in data && data.error) || "Failed to get Hume auth.");
      }

      auth = data;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to get Hume auth.");
      setState("error");
      return;
    }

    try {
      pushDebug(`[VoiceChat] calling Hume connect configId=${auth.configId ?? "none"}`);
      await connect({
        auth: { type: "apiKey", value: auth.apiKey },
        configId: auth.configId,
        sessionSettings: {
          type: "session_settings",
          variables: {
            intervention_guidance: "",
          },
        },
      });
      pushDebug("[VoiceChat] Hume connect resolved");
    } catch (connectError) {
      console.error("[VoiceChat] Hume connect failed", connectError);
      pushDebug(
        `[VoiceChat] Hume connect failed ${connectError instanceof Error ? connectError.message : "unknown error"}`,
      );
      setError(connectError instanceof Error ? connectError.message : "Failed to connect to Hume.");
      setState("error");
    }
  };

  const disconnectVoice = async () => {
    pushDebug("[VoiceChat] disconnect requested");
    try {
      await disconnect();
      pushDebug("[VoiceChat] disconnect resolved");
    } finally {
      clearMessages();
      lastTranscriptRef.current = "";
      setTranscript("");
      setSeconds(0);
      setError(null);
      setState("idle");
    }
  };

  const toggleMute = () => {
    pushDebug(`[VoiceChat] toggle mute nextMuted=${String(!isMuted)}`);
    if (isMuted) {
      unmute();
      return;
    }

    mute();
  };

  const handleBack = async () => {
    await disconnectVoice();
    onClose();
  };

  const amplitude = state === "speaking" ? 1 : 0.45;
  const timerText = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const showConnectButton =
    state === "idle" || state === "error" || readyState === VoiceReadyState.CONNECTING || readyState === VoiceReadyState.CLOSED;
  const hasLongTranscript = transcript.length > 180;
  const hasVeryLongTranscript = transcript.length > 320;
  const transcriptClassName = hasVeryLongTranscript
    ? "text-sm leading-7 text-gray-800 sm:text-base"
    : hasLongTranscript
      ? "text-sm leading-7 text-gray-800 sm:text-lg"
      : "text-base leading-relaxed text-gray-800 sm:text-lg";

  return (
    <div className="relative mx-auto flex min-h-[80vh] w-full flex-col overflow-hidden rounded-2xl bg-white p-2 sm:min-h-[84vh] sm:min-w-4xl sm:max-w-4xl sm:p-0">
      <div className="shrink-0 px-1 pt-1 sm:px-3 sm:pt-3">
        <Button onClick={() => void handleBack()} variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3 pt-2 sm:px-8 sm:pb-5">
        <div className="shrink-0 pb-3 text-center text-base font-medium text-gray-700 sm:pb-2 sm:text-lg">{timerText}</div>

        <div className="flex shrink-0 justify-center">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-full sm:h-[220px] sm:w-[220px]">
            <div className="rotate-[3.35rad]">
              <Aurora
                colorStops={["#00eaff", "#00eaff", "#00eaff"]}
                blend={0.5}
                amplitude={amplitude}
                speed={state === "speaking" ? 2 : 0.35}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-1 flex-col justify-center">
          <div className="flex flex-1 items-center justify-center px-1 py-1">
            <div className="max-w-sm text-center sm:max-w-md lg:max-w-lg">
              {isMuted && readyState === VoiceReadyState.OPEN ? (
                <div className="rounded-2xl py-2 text-gray-500">
                  Psst... <span className="text-red-500">unmute</span> so <span className="handwriting-font">mello</span> can hear you
                </div>
              ) : transcript ? (
                <div className={transcriptClassName}>{transcript}</div>
              ) : (
                <div className="rounded-2xl py-2 text-gray-500">
                  <span className="handwriting-font">mello</span>
                  <span className="text-[#758bfd]"> listening </span>
                  so say what is on your mind
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 pt-1">
            {error && <div className="mx-auto max-w-md rounded-md bg-red-100 px-3 py-2 text-center text-sm text-red-600">{error}</div>}

            {currentIntervention && readyState === VoiceReadyState.OPEN && (
              <div className="mx-auto mt-2 w-fit rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-sky-700 sm:text-xs">
                Active guidance: {currentIntervention.type.replace(/_/g, " ")}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex shrink-0 items-center justify-center gap-3 border-t border-slate-100 bg-white/95 pt-3">
          {showConnectButton ? (
            <Button
              onClick={() => void connectVoice()}
              disabled={readyState === VoiceReadyState.CONNECTING}
              className="rounded-full bg-white px-6 text-gray-700 hover:bg-gray-100"
              variant="outline"
            >
              {readyState === VoiceReadyState.CONNECTING ? "Connecting..." : "Connect Voice"}
            </Button>
          ) : (
            <>
              <ActionButton
                type="button"
                variant={isMuted ? "outline" : "primary"}
                onClick={toggleMute}
                className="h-16 w-16 border border-solid border-[#cccac6] shadow-lg"
                icon={isMuted ? <MicOff className="h-8 w-8 text-red-500" /> : <Mic className="h-8 w-8 text-[#758bfd]" />}
              />
              <Button variant="outline" className="rounded-full" onClick={() => void handleBack()}>
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
