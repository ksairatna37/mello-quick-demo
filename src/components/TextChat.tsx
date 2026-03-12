import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import TypewriterText from "./TypewriterText";
import LoadingDots from "./LoadingDots";

const AI_AVATAR = new URL("../assets/Group 21.png", import.meta.url).href;

interface TextChatProps {
  onClose: () => void;
}

interface DemoMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

const TextChat = ({ onClose }: TextChatProps) => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "";

  const initial = useMemo<DemoMessage>(
    () => ({
      id: uuidv4(),
      text: "Hey, I am mello. I am here with you. What is on your mind today?",
      isUser: false,
      timestamp: new Date().toISOString(),
    }),
    [],
  );

  useEffect(() => {
    setMessages([initial]);
  }, [initial]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const callAzureText = async (userMessage: string, history: DemoMessage[]) => {
    const historicalMessages = history.slice(-20).map((msg) => ({
      role: msg.isUser ? "user" : "assistant",
      content: msg.text,
    }));

    const payload = {
      messages: [...historicalMessages, { role: "user", content: userMessage }],
      max_completion_tokens: 300,
    };

    const response = await fetch(`${apiBaseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Azure returned empty response");
    }

    return reply.trim();
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    const userEntry: DemoMessage = {
      id: uuidv4(),
      text: userMessage,
      isUser: true,
      timestamp: new Date().toISOString(),
    };

    setMessage("");
    setMessages((prev) => [...prev, userEntry]);
    setIsLoading(true);

    try {
      const reply = await callAzureText(userMessage, messages);

      const aiEntry: DemoMessage = {
        id: uuidv4(),
        text: reply,
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiEntry]);
    } catch (error) {
      const aiEntry: DemoMessage = {
        id: uuidv4(),
        text: "I could not reach the chat server. Check backend env values and try again.",
        isUser: false,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiEntry]);
      console.error("Text chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[80vh] w-full max-w-4xl flex-col rounded-2xl p-2 sm:p-0">
      <Button onClick={onClose} variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700">
        <ArrowLeft />
      </Button>

      <div ref={messagesContainerRef} className="flex-1 space-y-1 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-center py-1 ${msg.isUser ? "justify-end" : "justify-start"}`}>
            {!msg.isUser && (
              <div className="hidden sm:block mr-3 h-10 w-10 flex-shrink-0 rounded-full">
                <img src={AI_AVATAR} alt="AI" className="h-full w-full object-cover" />
              </div>
            )}

            <div className="max-w-[100%] sm:max-w-[60%]">
              <p className="rounded-xl bg-gradient-to-r from-[#BFA9FE]/20 to-[#E3C1F9]/20 py-2 px-3 md:p-3 text-base sm:text-base text-gray-800 md:text-lg tracking-tight md:tracking-normal leading-tight md:leading-normal font-[430] md:font-normal">
                {msg.isUser ? (
                  <span className="whitespace-pre-wrap text-base sm:text-base md:text-lg tracking-tight md:tracking-normal leading-tight md:leading-normal font-[430] md:font-normal">{msg.text}</span>
                ) : (
                  <TypewriterText text={msg.text} speed={20} />
                )}
              </p>
            </div>

            {msg.isUser && (
              <Avatar className="hidden sm:block ml-3 h-10 w-10 flex-shrink-0">
                <AvatarFallback className="bg-mello-purple bg-opacity-20 text-gray-800">Y</AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center py-2">
            <div className="mr-3 h-10 w-10 flex-shrink-0 rounded-full">
              <img src={AI_AVATAR} alt="AI" className="h-full w-full object-cover" />
            </div>
            <div className="max-w-[60%]">
              <div className="rounded-2xl bg-gradient-to-r from-[#BFA9FE]/20 to-[#E3C1F9]/20 px-4 py-2">
                <LoadingDots />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isLoading ? "Please wait..." : "Type your message"}
          disabled={isLoading}
          className="w-full rounded-full bg-[rgba(239,237,250,0.4)] p-4 pr-20 text-base focus:outline-none disabled:opacity-50 sm:bg-[#DBDBDB]"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        {/* <Button
          onClick={() => setMessage("")}
          variant="ghost"
          size="icon"
          className="absolute right-12 top-1/2 -translate-y-1/2 transform text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </Button> */}

        <Button
          onClick={handleSend}
          variant="ghost"
          size="icon"
          disabled={isLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 transform text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default TextChat;
