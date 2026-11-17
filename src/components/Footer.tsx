import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-gray-300 pt-12 pb-8 border-t border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand & Security */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center text-slate-900 dark:text-white font-black text-2xl mb-3 tracking-tight">
              <img src="/favicon.png" alt="FrontDesk Pro" className="w-8 h-8 rounded-lg mr-2.5 object-cover shadow-xs" />
              FrontDesk&nbsp;<span className="text-blue-600 dark:text-blue-500 font-black">Pro</span>
            </Link>
            <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
              The all-in-one hospitality front desk platform — register management, sales lead tracking, complaint logs, and shift handoffs. Built for hotel front desks.
            </p>
            <div className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80 shadow-xs">
              <Shield size={14} className="mr-1.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium text-emerald-800 dark:text-emerald-300">100% Client-Side. No financial data leaves your device.</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Applications
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-400">
              <li>
                <Link to="/app" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Front Desk Register
                </Link>
              </li>
              <li>
                <Link to="/guide" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Cash Balancing Guide
                </Link>
              </li>
              <li>
                <a href="/#features" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Feature Tour
                </a>
              </li>
              <li>
                <Link to="/about" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  About Our Platform
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Guides */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Guides & Support
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-400">
              <li>
                <Link to="/guide#faq" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Frequently Asked Questions
                </Link>
              </li>
              <li>
                <Link to="/guide#discrepancies" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Handling Cash Discrepancies
                </Link>
              </li>
              <li>
                <Link to="/guide#shift-drop" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Mid-Shift Drop Procedures
                </Link>
              </li>
              <li>
                <Link to="/contacts" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance (AdSense Mandatory) */}
          <div>
            <h4 className="text-slate-900 dark:text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Trust & Legal
            </h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-400">
              <li>
                <Link to="/privacy" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/about#security" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  Data Security Architecture
                </Link>
              </li>
              <li>
                <a
                  href="https://www.google.com/settings/ads"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-white transition-colors"
                >
                  Ad Choices & Privacy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-gray-800 pt-6 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 dark:text-gray-500">
          <p>© {currentYear} FrontDesk Pro. All rights reserved.</p>
          <div className="flex space-x-6 mt-3 md:mt-0">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/guide" className="hover:underline">SOP Guide</Link>
            <Link to="/contacts" className="hover:underline">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
