import React from 'react';
import { 
  ShieldCheck, 
  Clock, 
  ChevronRight,
  Printer,
  Calculator,
  Lock,
  ArrowRight,
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AdUnit } from './AdUnit';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="flex-grow">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck size={16} className="text-blue-600" />
            <span>100% Client-Side & Private • Zero Cloud Database</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight max-w-4xl mx-auto mb-6">
            Intelligent Cash Drawer & Till Management for Businesses
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Eliminate cash discrepancies and manual calculation errors. Count opening floats, track mid-shift drops, balance registers, and generate instant PDF & thermal print receipts.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <Link
              to="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition transform active:scale-98"
            >
              Open Cash Register <ChevronRight className="ml-2" size={20} />
            </Link>
            <Link
              to="/guide"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 border border-gray-300 text-base font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:text-blue-600 shadow-sm transition"
            >
              <BookOpen size={18} className="mr-2 text-gray-500" />
              Till Balancing SOP Guide
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 text-xs text-gray-500 font-medium pt-2">
            <span className="flex items-center">
              <CheckCircle2 size={15} className="text-green-500 mr-1.5" /> No Registration Required
            </span>
            <span className="flex items-center">
              <CheckCircle2 size={15} className="text-green-500 mr-1.5" /> Thermal & PDF Print Ready
            </span>
            <span className="flex items-center">
              <CheckCircle2 size={15} className="text-green-500 mr-1.5" /> Offline Capable (IndexedDB)
            </span>
          </div>
        </div>

        {/* Top AdSense Placement */}
        <div className="max-w-5xl mx-auto px-4">
          <AdUnit slot="1234567890" format="auto" />
        </div>

        {/* Features Grid */}
        <div id="features" className="py-16 bg-white border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                Operational Excellence
              </h2>
              <h3 className="text-3xl font-extrabold text-gray-900">
                Engineered for High-Volume Retail & Food Service
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<Calculator size={26} className="text-blue-600" />}
                title="Granular Denomination Tally"
                description="Easily count bills ($100 to $1), coins, bank coin rolls, and manual payout receipts with instant auto-updating sub-totals."
              />
              <FeatureCard
                icon={<Clock size={26} className="text-indigo-600" />}
                title="Shift Drops & Cash Skims"
                description="Safely skim excess cash during peak hours. Track who completed the drop, timestamp, and safe deposit total."
              />
              <FeatureCard
                icon={<Printer size={26} className="text-emerald-600" />}
                title="Instant Print & PDF Export"
                description="Generate formatted shift receipts ready for 80mm thermal receipt printers or download comprehensive audit PDF reports."
              />
              <FeatureCard
                icon={<Lock size={26} className="text-purple-600" />}
                title="Client-Side Privacy"
                description="Stored securely inside your local browser database. Zero corporate tracking, zero external database leaks."
              />
            </div>
          </div>
        </div>

        {/* Guide Highlight Banner */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-8 md:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-2xl">
                <span className="text-blue-300 font-bold uppercase tracking-wider text-xs block mb-2">
                  Training & Standard Operating Procedures
                </span>
                <h3 className="text-2xl md:text-3xl font-bold mb-3">
                  Need a Standard Cash Handling Policy for Your Staff?
                </h3>
                <p className="text-blue-100 text-sm md:text-base leading-relaxed">
                  Learn how to establish opening floats, investigate over/short variances, avoid counterfeit risks, and train new cashiers with our complete retail SOP guide.
                </p>
              </div>
              <Link
                to="/guide"
                className="shrink-0 bg-white text-blue-900 font-bold px-6 py-3.5 rounded-xl hover:bg-blue-50 transition shadow inline-flex items-center"
              >
                Read SOP Guide & FAQ <ArrowRight size={18} className="ml-2" />
              </Link>
            </div>
          </div>
        </div>

        {/* In-content Bottom Ad */}
        <div className="max-w-5xl mx-auto px-4 py-8">
          <AdUnit slot="9876543210" format="auto" />
        </div>
      </main>

      <Footer />
    </div>
  );
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
}) {
  return (
    <div className="bg-gray-50/70 p-6 rounded-xl border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition duration-200">
      <div className="p-3 bg-white w-fit rounded-lg shadow-xs mb-4 border border-gray-100">{icon}</div>
      <h4 className="text-lg font-bold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}
