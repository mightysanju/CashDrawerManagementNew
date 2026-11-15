import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, BookOpen, Sun, Moon } from 'lucide-react';
import { useTheme } from '../utils/themeManager';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm fixed w-full top-0 z-50 border-b border-gray-100 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2.5">
              <img src="/favicon.png" alt="FrontDesk Pro" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                FrontDesk <span className="text-blue-600 dark:text-blue-400">Pro</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1 lg:space-x-3">
            <Link
              to="/guide"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                isActive('/guide')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen size={16} className="mr-1.5" />
              SOP Guide & FAQ
            </Link>
            <Link
              to="/about"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              About
            </Link>
            <Link
              to="/contacts"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/contacts')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              Contact
            </Link>
            <Link
              to="/privacy"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/privacy')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
            >
              Privacy
            </Link>
            
            {/* Animated FrontDesk Call-To-Action Button on Right */}
            <Link
              to="/app"
              className="ml-2 relative group inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] hover:bg-[right_center] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 overflow-hidden"
            >
              {/* Shimmer sweep animation */}
              <span className="absolute inset-0 w-full h-full bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />
              
              {/* Live pulsing online beacon */}
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>

              <span className="tracking-wide">FrontDesk</span>
              <span className="text-blue-200 group-hover:translate-x-0.5 transition-transform duration-200 font-bold">→</span>
            </Link>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="ml-2 p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition shadow-xs flex items-center justify-center cursor-pointer"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <Sun size={17} className="text-amber-400" />
              ) : (
                <Moon size={17} className="text-slate-600 dark:text-slate-300" />
              )}
            </button>
          </div>

          {/* Mobile menu and dark mode buttons */}
          <div className="flex items-center space-x-1 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-200 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg">
          <div className="px-3 pt-2 pb-4 space-y-1">
            <Link
              to="/app"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-bold text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400 hover:bg-blue-100"
            >
              🚀 FrontDesk
            </Link>
            <Link
              to="/guide"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              SOP Guide & FAQ
            </Link>
            <Link
              to="/about"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              About
            </Link>
            <Link
              to="/contacts"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Contact
            </Link>
            <Link
              to="/privacy"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Privacy
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
