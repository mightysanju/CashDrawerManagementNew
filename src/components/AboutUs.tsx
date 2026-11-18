import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AdUnit } from './AdUnit';
import { 
  Lock, 
  Cpu, 
  Users, 
  Award, 
  Globe, 
  Linkedin, 
  Code, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Building2,
  Terminal,
  MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function AboutUs() {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 flex flex-col justify-between pt-16 transition-colors">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Hero Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <Users size={14} />
            <span>Mission, Engineering & Leadership</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
            About FrontDesk Pro
          </h1>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Empowering independent hotels, motels, resorts, and retail operations with zero-subscription till reconciliation, shift logs, group sales pipelines, and offline-capable LAN sync.
          </p>
        </div>

        {/* AdSense Placement Top */}
        <AdUnit slot="1122334455" format="auto" />

        {/* Lead Architect & Developer Card — Balanced Editorial with Left Identity Backdrop */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 mb-10 shadow-xs transition-colors overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-6 md:gap-8">
            
            {/* Left Column: Styled Portrait Backdrop Panel */}
            <div className="w-full sm:w-60 shrink-0 bg-gradient-to-b from-slate-50 via-blue-50/40 to-slate-100/60 dark:from-slate-800/80 dark:via-slate-800/40 dark:to-slate-850 rounded-xl border border-slate-200/70 dark:border-slate-750 p-6 flex flex-col items-center text-center justify-between relative overflow-hidden group">
              {/* Subtle ambient lighting accent */}
              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-blue-500/10 dark:from-blue-400/10 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center">
                {/* Portrait with Ring & Status Indicator */}
                <div className="relative mb-3.5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center font-bold text-2xl tracking-tight border-3 border-white dark:border-slate-700 shadow-md ring-4 ring-blue-500/10 dark:ring-blue-400/10 overflow-hidden relative">
                    {!avatarFailed ? (
                      <img 
                        src="/sanju-kumar.png" 
                        alt="Sanju Kumar" 
                        className="w-full h-full object-cover"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <span className="font-bold text-2xl tracking-tight">
                        SK
                      </span>
                    )}
                  </div>
                  <div 
                    className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-800 shadow-xs z-10" 
                    title="Active Maintainer"
                  />
                </div>

                <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  Sanju Kumar
                </h3>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Lead Architect &amp; Founder
                </span>
              </div>

              {/* Badges on Bottom of Left Backdrop */}
              <div className="relative z-10 w-full pt-4 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 text-[11px] font-medium">
                  <MapPin size={12} className="text-slate-400" />
                  <span>Illinois, USA</span>
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Active Development</span>
                </div>
              </div>
            </div>

            {/* Right Column: Bio, Philosophy & Direct Connect Actions */}
            <div className="flex-1 flex flex-col justify-between space-y-4 min-w-0 py-1">
              <div>
                <div className="mb-3.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 mb-1.5">
                    Engineering Leadership
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                    Designed &amp; Engineered for Modern Front Desks
                  </h2>

                  {/* Direct Connect Buttons — Right under title above paragraph */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-3">
                    <a
                      href="https://mightysanju.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition shadow-2xs"
                    >
                      <Globe size={13} className="text-slate-500" />
                      <span>mightysanju.com</span>
                      <ExternalLink size={11} className="opacity-50" />
                    </a>

                    <a
                      href="https://linkedin.com/in/mightysanju"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0A66C2] hover:bg-[#084e96] transition shadow-2xs"
                    >
                      <Linkedin size={13} />
                      <span>LinkedIn Profile</span>
                      <ExternalLink size={11} className="opacity-70" />
                    </a>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  Engineered by Sanju Kumar to give hotel front desk teams and independent retail operators a fast, dependable, zero-subscription operations system. FrontDesk Pro unites local-first client architecture, peer-to-peer LAN terminal sync, and native Hotel Key PMS Chrome extension integration into a cohesive tool that respects data privacy and keeps front desks running smoothly.
                </p>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every feature is built on zero-compromise architectural principles: all shifts and complaints stay inside your local browser storage (IndexedDB), workstations sync peer-to-peer over local network without cloud servers, and in-line PMS scraping eliminates tedious manual folio entry.
                </p>
              </div>

              {/* Technical Craft Tags Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200/80 dark:border-slate-700/60">TypeScript</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200/80 dark:border-slate-700/60">React 18</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200/80 dark:border-slate-700/60">WebRTC Mesh LAN</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200/80 dark:border-slate-700/60">IndexedDB Local</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200/80 dark:border-slate-700/60">Manifest V3 Extension</span>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded border border-slate-200/80 dark:border-slate-700/60">jsPDF Engine</span>
              </div>
            </div>

          </div>
        </div>

        {/* Core Story & Vision */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xs border border-slate-200 dark:border-slate-800 p-6 md:p-8 mb-8 space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed transition-colors">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
            Why FrontDesk Pro Was Built
          </h2>
          <p>
            In modern hospitality and retail operations, till reconciliation at shift turnover is an indispensable financial safeguard. Yet hotel general managers and front desk clerks were consistently caught between two bad options: clunky enterprise PMS software with expensive recurring fees, or error-prone handwritten paper balance sheets.
          </p>
          <p>
            <strong>FrontDesk Pro</strong> was built to deliver a modern, zero-latency, and 100% free solution. Cashiers can count denominations with live automated math, record mid-shift envelope drops to safe, track overages and shortages, log guest complaints, manage group sales pipelines, and instantly generate audit-ready 4-box PDF reconciliation reports or thermal register slips.
          </p>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white pt-2">
            Key Architectural Pillars
          </h3>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl p-5 text-center">
              <Lock className="mx-auto text-blue-600 dark:text-blue-400 mb-2.5" size={28} />
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Local IndexedDB</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">All shifts, logs, and categories are stored securely inside your browser's persistent sandbox.</p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 rounded-xl p-5 text-center">
              <ShieldCheck className="mx-auto text-emerald-600 dark:text-emerald-400 mb-2.5" size={28} />
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">Zero Cloud Upload</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">No dollar figures, guest names, or employee passwords are ever transmitted to external servers.</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 rounded-xl p-5 text-center">
              <Building2 className="mx-auto text-purple-600 dark:text-purple-400 mb-2.5" size={28} />
              <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1">LAN P2P Multi-Sync</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">Terminals communicate over local Wi-Fi / Ethernet via WebRTC without requiring active internet.</p>
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white pt-4">
            How We Keep This Service Free
          </h3>
          <p>
            We sustain ongoing maintenance, feature releases, and hosting through non-intrusive advertisements. We never sell proprietary operational records, we never lock essential features behind paywalls, and we never charge per-terminal licenses.
          </p>
          <p>
            Have feedback, an integration idea, or need custom technical assistance? Contact our engineering team directly through our <Link to="/contacts" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">Contact Page</Link>.
          </p>
        </div>

        {/* AdSense Placement Bottom */}
        <AdUnit slot="5544332211" format="auto" />
      </main>

      <Footer />
    </div>
  );
}

export default AboutUs;
