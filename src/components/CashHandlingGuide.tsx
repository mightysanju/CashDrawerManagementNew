import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AdUnit } from './AdUnit';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ShieldAlert, 
  CheckCircle2, 
  Calculator, 
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "What is an opening cash float and how much should it be?",
    answer: "An opening float is the fixed starting sum of bills and coins placed into a cash drawer at the start of each shift so the cashier can make change for early transactions. Depending on transaction volume, typical floats range between $100 and $300, weighted heavily toward lower denominations ($1, $5 bills, and quarters)."
  },
  {
    question: "What is the standard formula for balancing a cash drawer at end-of-shift?",
    answer: "The universal cash drawer balancing equation is: Expected Cash = Opening Float + Total Cash Sales - Cash Refunds - Cash Drops - Paid-Out Receipts. The Cash Discrepancy (Over/Short) is calculated as: Actual Counted Cash - Expected Cash."
  },
  {
    question: "Why and when should retail cashiers perform a 'Shift Drop'?",
    answer: "A shift drop (or cash skim) is the practice of removing excess cash—specifically larger bills ($50 and $100) or stacks of $20s—from the register and placing them into a drop safe. This reduces the financial risk of robbery, minimizes counterfeit exposure, and keeps the drawer within insured operating limits."
  },
  {
    question: "What is the acceptable tolerance for drawer overage or shortage?",
    answer: "Most retail, grocery, and hospitality businesses enforce an acceptable variance threshold of ±$2.00 to ±$3.00 per shift. Minor coin rounding errors are common, but discrepancies exceeding $5.00 typically trigger a mandatory recount and manager review."
  },
  {
    question: "Does the FrontDesk Pro platform store company financial data on the cloud?",
    answer: "No. The platform utilizes local IndexedDB browser storage. All shift numbers, cashier names, denomination counts, and reports reside exclusively on the device running the browser. No financial records are ever transmitted to any remote servers."
  },
  {
    question: "How can cashiers avoid common counting errors?",
    answer: "Best practices include: 1) Count bills sorted in the same direction and face-up; 2) Double-count new or crisp bills that easily stick together; 3) Separate rolled coins from loose change; 4) Ensure all manual paper payout receipts or voucher slips are entered under the receipts section before finalizing the count."
  }
];

export function CashHandlingGuide() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <BookOpen size={14} />
            <span>Retail & Hospitality SOP</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
            FrontDesk Pro Operations & SOP Guide
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Comprehensive Standard Operating Procedures (SOP) for accurate till counting, shift drops, audit compliance, and discrepancy prevention in modern retail.
          </p>
        </div>

        {/* AdSense Placement Top */}
        <AdUnit slot="1234567890" format="auto" />

        {/* Guide Content Sections */}
        <div className="space-y-10">
          {/* Step 1 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                1
              </span>
              <h2 className="text-2xl font-bold text-gray-900">
                Establishing the Opening Float
              </h2>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Before taking the first customer transaction, the assigned cashier and a supervisor must verify the starting float. The float ensures the till has sufficient change denominations throughout trading hours.
            </p>
            <div className="grid md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                  <CheckCircle2 size={16} className="text-green-600 mr-1.5" />
                  Recommended $200 Float Breakdown
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• $20 Bills: 2 notes ($40.00)</li>
                  <li>• $10 Bills: 4 notes ($40.00)</li>
                  <li>• $5 Bills: 10 notes ($50.00)</li>
                  <li>• $1 Bills: 50 notes ($50.00)</li>
                  <li>• Quarters, Dimes, Nickels, Pennies: Rolls ($20.00)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                  <ShieldAlert size={16} className="text-amber-600 mr-1.5" />
                  Cashier Verification Rule
                </h4>
                <p className="text-sm text-gray-600">
                  Always count the opening float in front of a supervisor or security camera. Never accept a pre-counted drawer without personally verifying every denomination and signing off in the digital register.
                </p>
              </div>
            </div>
          </section>

          {/* Step 2 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                2
              </span>
              <h2 className="text-2xl font-bold text-gray-900">
                Mid-Shift Cash Skims & Drops
              </h2>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed">
              As cash builds throughout peak business hours, registers exceed safe handling maximums. Conducting scheduled drops protects cashiers and limits store liability.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
              <h4 className="font-semibold text-blue-900 mb-1">Standard Drop Procedure:</h4>
              <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                <li>Identify accumulated $50 and $100 bills or surplus bundles of $20 notes.</li>
                <li>Record the exact dollar amount in the <strong>Shift Drop</strong> field in the register software.</li>
                <li>Place the cash with the generated drop slip into a sealed deposit envelope.</li>
                <li>Immediately transfer the drop into the dual-custody drop safe.</li>
              </ol>
            </div>
          </section>

          {/* Step 3 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-center space-x-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
                3
              </span>
              <h2 className="text-2xl font-bold text-gray-900">
                End-of-Shift Reconciliation & Discrepancies
              </h2>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed">
              When closing a till, follow a strict counting sequence to identify and isolate variances immediately.
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2 flex items-center">
                  <Calculator size={18} className="text-blue-600 mr-2" />
                  The Reconciliation Formula
                </h4>
                <div className="font-mono text-sm bg-white p-3 rounded border border-gray-300 text-gray-800">
                  Total Counted Cash + Total Receipts + Shift Drops - Opening Float = Actual Daily Cash Intake
                </div>
              </div>

              <div id="discrepancies" className="pt-2">
                <h4 className="font-semibold text-gray-800 mb-2">Investigating Over / Short Variances:</h4>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start">
                    <span className="text-red-500 font-bold mr-2">•</span>
                    <span><strong>Shortage ($ &lt; Expected):</strong> Verify whether a cash drop or vendor payout receipt was omitted from the register. Check beneath the till insert for stuck currency.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-600 font-bold mr-2">•</span>
                    <span><strong>Overage ($ &gt; Expected):</strong> Re-count higher denomination bills. Verify whether a credit card transaction was mistakenly tendered as cash in the point-of-sale system.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* AdSense Placement Middle */}
        <AdUnit slot="0987654321" format="auto" className="my-8" />

        {/* FAQ Section */}
        <div id="faq" className="mt-14 mb-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
              <HelpCircle size={14} />
              <span>Questions & Answers</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              Common questions regarding cash reconciliation and audit compliance.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, index) => (
              <div
                key={index}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-semibold text-gray-800 hover:text-blue-600 transition"
                  aria-expanded={openFaqIndex === index}
                >
                  <span className="pr-4">{faq.question}</span>
                  {openFaqIndex === index ? (
                    <ChevronUp size={20} className="shrink-0 text-blue-600" />
                  ) : (
                    <ChevronDown size={20} className="shrink-0 text-gray-400" />
                  )}
                </button>
                {openFaqIndex === index && (
                  <div className="px-6 pb-4 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Call to action */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-8 text-center mt-12 shadow-md">
          <h3 className="text-2xl font-bold mb-2">Ready to balance your register?</h3>
          <p className="text-blue-100 max-w-xl mx-auto mb-6 text-sm">
            Launch our free, 100% private in-browser till management counter. No sign-up, no monthly fees, and no cloud data transmission.
          </p>
          <Link
            to="/app"
            className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition shadow"
          >
            Open Cash Register App <ArrowRight size={18} className="ml-2" />
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
export default CashHandlingGuide;
