import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, BookOpen } from 'lucide-react';

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white/95 backdrop-blur-md shadow-sm fixed w-full top-0 z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2.5">
              <img src="/favicon.png" alt="FrontDesk Pro" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-xl font-bold text-gray-900">
                FrontDesk <span className="text-blue-600">Pro</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1 lg:space-x-4">
            <Link
              to="/guide"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${
                isActive('/guide')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={16} className="mr-1.5" />
              SOP Guide & FAQ
            </Link>
            <Link
              to="/about"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              About
            </Link>
            <Link
              to="/contacts"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/contacts')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Contact
            </Link>
            <Link
              to="/privacy"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/privacy')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              Privacy
            </Link>
            
            {/* Animated FrontDesk Call-To-Action Button on Right */}
            <Link
              to="/app"
              className="ml-3 relative group inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] hover:bg-[right_center] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 overflow-hidden"
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
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-b border-gray-200 bg-white shadow-lg">
          <div className="px-3 pt-2 pb-4 space-y-1">
            <Link
              to="/app"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-bold text-blue-600 bg-blue-50 hover:bg-blue-100"
            >
              🚀 FrontDesk
            </Link>
            <Link
              to="/guide"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              SOP Guide & FAQ
            </Link>
            <Link
              to="/about"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              About Platform
            </Link>
            <Link
              to="/contacts"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              Contact Us
            </Link>
            <Link
              to="/privacy"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-100"
            >
              Terms of Service
            </Link>
            <Link
              to="/app"
              onClick={() => setIsMenuOpen(false)}
              className="block px-3 py-2 mt-2 text-center rounded-md text-base font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Register
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
