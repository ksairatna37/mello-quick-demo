import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface MobileLayoutProps {
  children: React.ReactNode;
}

const MobileLayout = ({ children }: MobileLayoutProps) => {
  return (
    <div className="mello-gradient flex min-h-screen flex-col">
      <div className="flex items-center justify-between p-4">
        <h1 className="handwriting-font text-3xl text-black">mello</h1>
        <Avatar className="h-10 w-10 bg-mello-purple bg-opacity-20">
          <AvatarFallback className="text-gray-700">M</AvatarFallback>
        </Avatar>
      </div>
      <main className="flex-1 p-4">
        <div className="min-h-[calc(100vh-8rem)] rounded-xl bg-white p-2">{children}</div>
      </main>
    </div>
  );
};

export default MobileLayout;