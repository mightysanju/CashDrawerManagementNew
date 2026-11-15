import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Lock } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12 text-gray-700 space-y-6 leading-relaxed">
          <div className="border-b pb-4 mb-6">
            <span className="text-xs uppercase tracking-wider text-blue-600 font-bold block mb-1">
              Compliance & Data Protection
            </span>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Privacy Policy
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: November 13, {currentYear}
            </p>
          </div>

          <section>
            <p className="text-base text-gray-700">
              At <strong>FrontDesk Pro</strong> ("we", "our", or "us"), accessible from https://cashdrawermanagement.netlify.app, one of our main priorities is the privacy of our visitors. This Privacy Policy document outlines the types of information collected and how we protect your business and personal data in full compliance with global privacy standards, including the EU General Data Protection Regulation (GDPR), California Consumer Privacy Act (CCPA), and Google AdSense publisher policies.
            </p>
          </section>

          {/* Local Storage & Security Guarantee */}
          <section className="bg-blue-50/70 border border-blue-200 rounded-lg p-5">
            <div className="flex items-center space-x-2 text-blue-900 font-bold text-lg mb-2">
              <Lock size={20} className="text-blue-700" />
              <h2>Client-Side Local Storage & Zero Cloud Transmission</h2>
            </div>
            <p className="text-sm text-blue-900/90 leading-relaxed">
              Our core application is architected as a client-side web application. All cashier names, drawer counts, opening floats, shift drops, and financial tallies are saved exclusively in your web browser’s local IndexedDB database. <strong>We do not transmit, sync, process, or store your financial balances on our servers.</strong> Your cash records remain completely under your local control.
            </p>
          </section>

          {/* Google AdSense & Cookies Disclosures (MANDATORY for AdSense) */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Google AdSense & Third-Party Advertising
            </h2>
            <p className="mb-3">
              We partner with Google AdSense to display advertisements when you visit our website. To comply strictly with Google AdSense terms and policies, please review the following notices:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-3 text-sm text-gray-700">
              <li>
                <strong>Third-Party Vendors & Cookies:</strong> Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to our website or other websites across the Internet.
              </li>
              <li>
                <strong>DoubleClick DART Cookie:</strong> Google's use of advertising cookies enables it and its partners to serve targeted ads to our users based on their visits to our site and/or other sites on the Internet.
              </li>
              <li>
                <strong>Opting Out of Personalized Advertising:</strong> Users may opt out of personalized advertising at any time by visiting <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">Google Ads Settings</a>.
              </li>
              <li>
                <strong>Consumer Choice Opt-Out:</strong> Alternatively, you can opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">www.aboutads.info/choices</a> or <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium">Network Advertising Initiative</a>.
              </li>
            </ul>
          </section>

          {/* Web Analytics */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Web Analytics (Google Analytics)
            </h2>
            <p className="text-sm">
              We use Google Analytics (gtag.js) to understand visitor volume and app usage trends. Google Analytics collects anonymized statistical metrics such as browser type, device category, referring URL, and pages viewed. This data does not contain any cash amounts, drawer numbers, or financial metrics.
            </p>
          </section>

          {/* GDPR Rights */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              GDPR Data Protection Rights (European Users)
            </h2>
            <p className="text-sm mb-2">
              Under the GDPR, European Union residents have specific rights regarding personal data:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-3 text-sm text-gray-600">
              <li><strong>The Right to Access:</strong> You can review all records stored on your device directly in the app's Shift History tab.</li>
              <li><strong>The Right to Erasure:</strong> You can delete all your stored shifts at any time using the "Clear History" button in the app.</li>
              <li><strong>The Right to Data Portability:</strong> You can export complete shift histories to PDF or print them at any time.</li>
            </ul>
          </section>

          {/* CCPA Disclosures */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              CCPA Privacy Rights (California Residents)
            </h2>
            <p className="text-sm">
              Under the California Consumer Privacy Act (CCPA), California consumers have the right to request disclosure of categories of personal data collected, request deletion, and opt-out of the sale of personal information. We do not sell your personal or business financial data to any third party.
            </p>
          </section>

          {/* Children's Information */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Children's Privacy Protection
            </h2>
            <p className="text-sm">
              Our service is intended for business operators, cashiers, and managers. We do not knowingly collect any personally identifiable information from children under the age of 13.
            </p>
          </section>

          {/* Contact Details */}
          <section className="bg-gray-50 border-l-4 border-blue-600 p-4 rounded-r-lg mt-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Contacting Our Data Privacy Team
            </h3>
            <p className="text-sm text-gray-600">
              If you have questions or require clarification regarding our privacy practices or advertising compliance, contact our support desk directly at:
              <br />
              <strong>Email:</strong> technerdelectronics@gmail.com
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
