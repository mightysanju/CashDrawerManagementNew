import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export function TermsOfService() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 text-gray-700 space-y-6 leading-relaxed">
          <div className="border-b pb-4 mb-6">
            <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">
              Legal Documentation
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Terms of Service
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Effective Date: November 13, {currentYear}
            </p>
          </div>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">1. Agreement to Terms</h2>
            <p>
              By accessing or using the <strong>Cash Drawer Management System</strong> ("Service", "Application", "we", "our"), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">2. Permitted Use of the Service</h2>
            <p>
              Our application is designed to assist retail cashiers, hospitality operators, and business owners in tallying currency, recording opening floats, executing mid-shift cash drops, and producing shift reconciliation reports.
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-3 mt-2 text-sm text-gray-600">
              <li>You may use the Service freely for personal or commercial business operations.</li>
              <li>You agree not to attempt to reverse engineer, disrupt, or impair the security or infrastructure of the web application.</li>
              <li>You agree not to use the Service for any unlawful financial manipulation or fraudulent reporting.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">3. Data Ownership & Storage Disclaimer</h2>
            <p>
              The Application operates on a <strong>client-side architecture</strong> utilizing your browser's IndexedDB engine. You acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-3 mt-2 text-sm text-gray-600">
              <li>All shift records and denomination counts remain solely on your local device.</li>
              <li>We do not maintain centralized cloud backups of your shift data. Clearing your browser cache or site data will permanently remove locally stored history unless you have exported your reports to PDF.</li>
              <li>You are solely responsible for exporting and preserving critical financial and accounting documentation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">4. Third-Party Advertisements</h2>
            <p>
              The Service displays third-party advertisements served by Google AdSense to sustain free access. We do not endorse third-party products advertised, and interactions with external advertisers are governed by the respective advertiser's terms and privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">5. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. While we strive for mathematical accuracy in cash calculations and report generation, you remain solely responsible for verifying final bank deposits, payroll allocations, and financial books.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, in no event shall Cash Drawer Management System, its developers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or cash discrepancies resulting from the use or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">7. Contact Information</h2>
            <p>
              For legal inquiries regarding these Terms of Service, please contact our support team at:
              <br />
              <strong>Email:</strong> technerdelectronics@gmail.com
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
export default TermsOfService;
