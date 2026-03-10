import React from "react";
import { Home, History, MessageCircleHeart, Settings, User } from "lucide-react";

const items = [
  { icon: <Home size={24} />, text: "Home" },
  { icon: <User size={24} />, text: "Profile" },
  { icon: <History size={24} />, text: "History" },
  { icon: <MessageCircleHeart size={24} />, text: "Feedback" },
  { icon: <Settings size={24} />, text: "Settings" },
];

const Sidebar = () => {
  return (
    <div className="fixed left-0 top-0 flex h-full w-72 flex-col justify-between bg-mello-sidebar p-4">
      <div className="space-y-4 pt-8">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.text}
            className={`flex w-full items-center space-x-4 rounded-lg px-3 py-2 text-left text-gray-700 ${index === 0 ? "mello-gradient font-bold" : "hover:text-gray-900"}`}
          >
            <div>{item.icon}</div>
            <span className="text-lg font-medium">{item.text}</span>
          </button>
        ))}
      </div>
      <div className="mb-6 text-sm text-gray-500">Demo navigation</div>
    </div>
  );
};

export default Sidebar;