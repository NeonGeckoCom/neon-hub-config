import React from 'react';
import neonLogo from "../assets/neon_logo.svg";
import { Sun, Moon } from "lucide-react";

interface HeaderProps {
  isDark: boolean;
  toggleDarkMode: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDark, toggleDarkMode }) => {
  return (
    <div className="flex justify-between items-center mb-4">
      <img src={neonLogo} alt="Neon AI" className="h-10" />
      <h1 className={`text-2xl font-bold ${isDark ? "text-orange-200" : "text-orange-800"}`}>
        Neon Hub Management
      </h1>
      <button
        onClick={toggleDarkMode}
        className={`p-2 rounded-full ${
          isDark
            ? "bg-orange-200 text-orange-800"
            : "bg-orange-800 text-orange-200"
        }`}
      >
        {isDark ? <Sun size={24} /> : <Moon size={24} />}
      </button>
    </div>
  );
};

export default Header;