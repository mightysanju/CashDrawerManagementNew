import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, BookOpen, Sun, Moon, ArrowRight } from 'lucide-react';
import { useTheme } from '../utils/themeManager';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs fixed w-full top-0 z-50 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2.5">
              <img src="/favicon.png" alt="FrontDesk Pro" className="h-8 w-8 rounded-lg object-cover shadow-xs" />
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center">
                FrontDesk&nbsp;<span className="text-blue-600 dark:text-blue-500 font-black">Pro</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            <Link
              to="/guide"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center ${
                isActive('/guide')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen size={14} className="mr-1.5 text-slate-400" />
              SOP Guide & FAQ
            </Link>
            <Link
              to="/about"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive('/about')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              About
            </Link>
            <Link
              to="/contacts"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive('/contacts')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Contact
            </Link>
            <Link
              to="/privacy"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isActive('/privacy')
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Privacy
            </Link>
            
            {/* FrontDesk Call-To-Action Button — Welcoming & Animated */}
            <Link
              to="/app"
              className="group relative ml-3 inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] hover:bg-right text-white px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-indigo-600/35 hover:scale-105 active:scale-95 ring-1 ring-white/20 overflow-hidden cursor-pointer"
            >
              {/* Shimmer sweep animation on hover */}
              <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-[-20deg] -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-out pointer-events-none" />

              {/* Pulsing Live Beacon Indicator */}
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-xs" />
              </span>

              <span className="tracking-wide">Open Register</span>
              <ArrowRight size={13} className="text-blue-200 group-hover:text-white group-hover:translate-x-1 transition-all duration-200 shrink-0" />
            </Link>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="ml-1 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <Sun size={15} className="text-amber-400" />
              ) : (
                <Moon size={15} className="text-slate-600" />
              )}
            </button>
          </div>

          {/* Mobile menu and dark mode buttons */}
          <div className="flex items-center space-x-1 md:hidden">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          <div className="px-3 pt-2 pb-4 space-y-1">
            <Link
              to="/app"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm transition active:scale-95"
            >
              <div className="flex items-center space-x-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span>Open Register</span>
              </div>
              <ArrowRight size={15} className="text-blue-100" />
            </Link>
            <Link
              to="/guide"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              SOP Guide & FAQ
            </Link>
            <Link
              to="/about"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              About
            </Link>
            <Link
              to="/contacts"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Contact
            </Link>
            <Link
              to="/privacy"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Privacy
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
export default Navbar;