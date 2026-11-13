import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AdUnit } from './AdUnit';
import { Lock, Cpu, Users, Award } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AboutUs() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        {/* Hero Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <Users size={14} />
            <span>Our Mission & Architecture</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            About Cash Drawer Management
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Empowering small businesses, independent retailers, restaurants, and non-profits with reliable, zero-subscription cash till reconciliation tools.
          </p>
        </div>

        {/* AdSense Placement */}
        <AdUnit slot="1122334455" format="auto" />

        {/* Core Story */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-8 space-y-6 text-gray-700 leading-relaxed">
          <h2 className="text-2xl font-bold text-gray-900 border-b pb-3">
            Why We Built This Platform
          </h2>
          <p>
            In retail and food service, till reconciliation at the beginning and end of each shift is a critical control. However, many business owners and shift managers are forced to choose between complex, expensive enterprise POS add-ons or error-prone handwritten paper till sheets.
          </p>
          <p>
            <strong>Cash Drawer Management</strong> was engineered to provide a modern, lightning-fast, and completely free alternative. Cashiers can count denominations with instant recalculation, log mid-shift cash drops, calculate overages or shortages, and immediately print formatted shift audit slips or download archival PDFs.
          </p>

          <h3 className="text-xl font-bold text-gray-900 pt-4">
            Our Architectural Guarantee: 100% Client-Side Privacy
          </h3>
          <p id="security">
            Most modern SaaS platforms require your employees to create accounts and upload your internal financial records to remote cloud databases. We believe small business cash flow records belong exclusively to the business owner.
          </p>
          <div className="grid md:grid-cols-3 gap-4 pt-2">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
              <Lock className="mx-auto text-blue-600 mb-2" size={28} />
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Local IndexedDB</h4>
              <p className="text-xs text-gray-600">All shifts are stored securely inside your browser's persistent sandbox.</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
              <Cpu className="mx-auto text-green-600 mb-2" size={28} />
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Zero Cloud Upload</h4>
              <p className="text-xs text-gray-600">No dollar figures or cashier names are transmitted over the web.</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 text-center">
              <Award className="mx-auto text-purple-600 mb-2" size={28} />
              <h4 className="font-semibold text-gray-900 text-sm mb-1">Instant Export</h4>
              <p className="text-xs text-gray-600">Export audit records to PDF or print directly to thermal receipt printers.</p>
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 pt-4">
            How We Keep This Service Free
          </h3>
          <p>
            We sustain our ongoing development and hosting through non-intrusive advertisements served via Google AdSense. We do not sell data, we do not require subscriptions, and we do not gate premium features behind paywalls.
          </p>
          <p>
            For inquiries, feature requests, or partnership opportunities, reach out to our engineering and support team via our <Link to="/contacts" className="text-blue-600 hover:underline font-semibold">Contact Page</Link>.
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
