import React, { useState } from 'react';
import { Mail, Clock, MapPin, UserCircle, Send, CheckCircle2 } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AdUnit } from './AdUnit';

export const ContactPage: React.FC = () => {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("https://formspree.io/f/mldekykj", {
        method: "POST",
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        setFormSubmitted(true);
        form.reset();
      } else {
        alert('There was an error submitting your message. Please email technerdelectronics@gmail.com directly.');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('There was an error submitting your message. Please email technerdelectronics@gmail.com directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between pt-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-3">
            Contact Support & Engineering
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Have questions about cash drawer balancing, accounting integrations, or feature suggestions? Our team is here to assist.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          {/* Contact Information Section */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">
                Get in Touch
              </h2>

              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                    <Mail size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Direct Support Email</h3>
                    <p className="text-gray-600 text-sm">technerdelectronics@gmail.com</p>
                    <span className="text-xs text-green-600 font-medium">Guaranteed response within 24-48 business hours</span>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
                    <Clock size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Help Desk Hours</h3>
                    <p className="text-gray-600 text-sm">Monday – Friday: 9:00 AM – 5:00 PM EST</p>
                    <p className="text-gray-600 text-sm">Saturday: 10:00 AM – 2:00 PM EST</p>
                    <p className="text-gray-400 text-xs">Sunday & Federal Holidays: Closed</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                    <MapPin size={22} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">Mailing Address</h3>
                    <p className="text-gray-600 text-sm">
                      1505 Potter Rd,
                      <br />
                      Glenview, IL 60026, United States
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
              <h4 className="font-semibold text-blue-900 text-sm mb-1">Looking for SOP guidance?</h4>
              <p className="text-xs text-blue-800">
                Check our detailed till balancing formulas and discrepancy FAQ in our Cash Handling Guide.
              </p>
            </div>
          </div>

          {/* Contact Form Section */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">
              Send a Message
            </h2>

            {formSubmitted ? (
              <div className="bg-green-50 border border-green-300 rounded-xl p-8 text-center my-6">
                <CheckCircle2 size={48} className="text-green-600 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-900 mb-1">Message Received!</h3>
                <p className="text-sm text-green-700">
                  Thank you for reaching out. A support engineer will review your inquiry and get back to you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} method="POST">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Jane Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Business Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="jane@retailstore.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                      Your Inquiry or Message
                    </label>
                    <div className="relative">
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="How can we assist your business operations?"
                      ></textarea>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center items-center bg-blue-600 text-white font-semibold py-2.5 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
                  >
                    {isSubmitting ? (
                      'Sending...'
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <AdUnit slot="4433221100" format="auto" />
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
