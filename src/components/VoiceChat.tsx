import { useState } from "react";
import EnglishVoiceChat from "./EnglishVoiceChat";
import HindiVoiceChat from "./HindiVoiceChat";

export type VoiceLanguage = "english" | "hindi";

interface VoiceChatProps {
  onClose: () => void;
}

const VoiceChat = ({ onClose }: VoiceChatProps) => {
  const [language, setLanguage] = useState<VoiceLanguage>("english");

  if (language === "hindi") {
    return (
      <HindiVoiceChat
        onClose={onClose}
        onBack={onClose}
        language={language}
        setLanguage={setLanguage}
      />
    );
  }

  return (
    <EnglishVoiceChat
      onClose={onClose}
      onBack={onClose}
      language={language}
      setLanguage={setLanguage}
    />
  );
};

export default VoiceChat;
