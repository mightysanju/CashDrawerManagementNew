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
            Hotel Front Desk Operations, Simplified
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            The all-in-one platform for front desk teams — manage cash registers, track group sales leads, log guest complaints, handle shift handoffs, and generate instant audit reports.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-10">
            <Link
              to="/app"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 border border-transparent text-base font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition transform active:scale-98"
            >
              Open Front Desk Register <ChevronRight className="ml-2" size={20} />
            </Link>
            <Link
              to="/guide"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 border border-gray-300 text-base font-semibold rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:text-blue-600 shadow-sm transition"
            >
              <BookOpen size={18} className="mr-2 text-gray-500" />
              Operations SOP Guide
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

        {/* Features Grid */}
        <div id="features" className="py-16 bg-white border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                Operational Excellence
              </h2>
              <h3 className="text-3xl font-extrabold text-gray-900">
                Built for Hotel & Hospitality Front Desks
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <FeatureCard
                icon={<Calculator size={26} className="text-blue-600" />}
                title="Cash Register & Denominations"
                description="Count bills and coins by denomination with live sub-totals. Track opening floats, mid-shift drops, and end-of-shift balances with printable audit receipts."
              />
              <FeatureCard
                icon={<Clock size={26} className="text-indigo-600" />}
                title="Sales Lead Pipeline"
                description="Log group, wedding, sports, and corporate leads. Track status from New Lead through to Closed Definite — with a Kanban board and revenue estimates."
              />
              <FeatureCard
                icon={<Printer size={26} className="text-emerald-600" />}
                title="Shift Log & Complaint Tracking"
                description="Record guest complaints and miscellaneous notes each shift. Add threaded responses, set reminders, and hand off cleanly to the next clerk."
              />
              <FeatureCard
                icon={<Lock size={26} className="text-purple-600" />}
                title="100% Local & Private"
                description="All data stays in your browser's IndexedDB — zero cloud uploads, zero tracking. Multi-terminal sync via peer-to-peer BroadcastChannel."
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
                  Need a Standard Hospitality Operations Policy for Your Staff?
                </h3>
                <p className="text-blue-100 text-sm md:text-base leading-relaxed">
                  Learn how to run shift handoffs, handle cash discrepancies, track group sales leads, and document guest complaints — with our complete hotel front desk SOP guide.
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
