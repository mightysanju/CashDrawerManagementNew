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
              <img src="/favicon.png" alt="FrontDesk Pro" className="h-7 w-7 rounded-md object-cover" />
              <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                FrontDesk <span className="text-blue-600 dark:text-blue-400">Pro</span>
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
            
            {/* FrontDesk Call-To-Action Button */}
            <Link
              to="/app"
              className="ml-3 inline-flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Register</span>
              <ArrowRight size={13} className="text-blue-200" />
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
              className="block px-3 py-2 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 dark:bg-slate-800 dark:text-blue-400"
            >
              Register
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