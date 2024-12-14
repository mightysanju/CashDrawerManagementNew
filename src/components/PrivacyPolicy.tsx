import React from 'react';
import { Navbar } from './Navbar';

const PrivacyPolicy: React.FC = () => {
  return (
    <div>  <Navbar />  
    <div className="min-h-screen pt-28 bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">
          Privacy Policy
        </h1>
        
        <div className="text-gray-700 space-y-6">
          <section>
            <p className="text-sm text-gray-500 mb-4">
              Last updated: 12/13/2024
            </p>
            
            <p className="mb-4">
              The Cash Drawer Management System is committed to protecting your privacy. We collect and store only essential business information necessary for cash drawer management.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Collected Information
            </h2>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Organization names (optional)</li>
              <li>Drawer numbers</li>
              <li>Cashier names</li>
              <li>Shift records and transaction data</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Data Storage
            </h2>
            <p className="mb-4">
              All data is stored locally in your browser using secure IndexedDB storage. We do not transmit or share your data with third parties. Your cash drawer information remains completely private and under your control.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Data Usage Policy
            </h2>
            <p className="mb-4">
              Our application processes data in accordance with standard business practices and Google's data usage requirements:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-4">
              <li>Data is stored locally and encrypted in your browser</li>
              <li>No personal information is collected beyond business operations</li>
              <li>PDF reports are generated locally and never uploaded</li>
              <li>You maintain full control over your data</li>
              <li>Data can be exported or deleted at any time</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Advertising
            </h2>
            <p className="mb-4">
              We use Google AdSense to display relevant advertisements. AdSense may use cookies and data as outlined in Google's privacy policy to provide targeted advertising. You can opt out of personalized advertising through Google's Ad Settings.
            </p>
          </section>
          
          <section className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              Contact Information
            </h3>
            <p className="text-yellow-700">
              If you have any questions about this Privacy Policy, please contact our support team at technerdelectronics@gmail.com.
            </p>
          </section>
        </div>
        
        <footer className="mt-8 text-center text-sm text-gray-500">
          © 2024 Cash Drawer Management System. All rights reserved.
        </footer>
      </div>
    </div></div>

  );
};

export default PrivacyPolicy;