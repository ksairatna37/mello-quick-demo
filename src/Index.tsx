import React, { useState } from "react";
import { MessageSquare, Mic } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import TextChat from "@/components/TextChat";
import VoiceChat from "@/components/VoiceChat";

type ChatMode = "text" | "voice" | null;

const Index = () => {
  const [chatMode, setChatMode] = useState<ChatMode>(null);

  const handleClose = () => {
    setChatMode(null);
  };

  return (
    <Layout>
      <div className="flex h-full flex-col items-center justify-center">
        {!chatMode ? (
          <div className="space-y-64 text-center md:space-y-48">
            <h2 className="handwriting-font mt-6 text-3xl font-regular text-purple-400 sm:mr-10 sm:mt-0 md:text-4xl">hi dear</h2>
            <h3 className="mx-auto max-w-2xl px-4 text-2xl font-medium text-gray-800 sm:mr-8 md:text-4xl">
              How can I support your mind today?
            </h3>
            <div className="flex justify-center gap-4 sm:mr-8">
              <Button onClick={() => setChatMode("text")} variant="outline" className="flex items-center gap-2 px-6">
                <MessageSquare className="h-5 w-5" />
                Text
              </Button>
              <Button onClick={() => setChatMode("voice")} variant="outline" className="flex items-center gap-2 px-6">
                <Mic className="h-5 w-5" />
                Voice
              </Button>
            </div>
          </div>
        ) : (
          <>
            {chatMode === "text" && <TextChat onClose={handleClose} />}
            {chatMode === "voice" && <VoiceChat onClose={handleClose} />}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Index;