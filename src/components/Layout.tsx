import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileLayout from "./MobileLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return (
    <div className="mello-gradient flex min-h-screen">
      <div className="flex-1">
        <div className="flex min-h-screen flex-col p-8">
          <header className="mb-8 flex items-center justify-between">
            <div></div>
            <h1 className="handwriting-font text-4xl text-black">mello</h1>
            <Avatar className="h-10 w-10 bg-mello-purple bg-opacity-20">
              <AvatarFallback className="text-gray-700">M</AvatarFallback>
            </Avatar>
          </header>
          <main className="flex-1">
            <div className="min-h-[calc(100vh-8rem)] rounded-3xl bg-gray-100 p-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
