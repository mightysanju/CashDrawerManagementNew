import React, { useState } from 'react';
import { Mail, Phone, MapPin, UserCircle, MessageCircle } from 'lucide-react';

import { Navbar } from './Navbar';

const ContactPage: React.FC = () => {
  const [formSubmitted, setFormSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
        alert('There was an error submitting your form');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      alert('There was an error submitting your form');
    }
  };

  return (
    <div><Navbar />
    <div className="min-h-screen bg-gray-50 pt-32 py-12 px-4 sm:px-6 lg:px-8">
        
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
        {/* Contact Information Section */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">
            Contact Information
          </h2>
          
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <Mail className="text-blue-500 w-6 h-6" />
              <div>
                <h3 className="font-semibold text-gray-800">Email</h3>
                <p className="text-gray-600">technerdelectronics@gmail.com</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Phone className="text-green-500 w-6 h-6" />
              <div>
                <h3 className="font-semibold text-gray-800">Phone</h3>
                <p className="text-gray-600">(224) XXX-XXXX</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <MapPin className="text-red-500 w-6 h-6" />
              <div>
                <h3 className="font-semibold text-gray-800">Address</h3>
                <p className="text-gray-600">
                  1505 Potter Rd, 
                  <br />
                  Glenview, IL 60026
                </p>
              </div>
            </div>
            
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">
                Support Hours
              </h3>
              <p className="text-blue-700">
                Monday - Friday: 9:00 AM - 5:00 PM EST
                <br />
                Saturday: 10:00 AM - 2:00 PM EST
                <br />
                Sunday: Closed
              </p>
            </div>
          </div>
        </div>
        
        {/* Contact Form Section */}
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b pb-4">
            Send Us a Message
          </h2>
          
          {formSubmitted ? (
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <p className="text-green-700 font-semibold">
                Thank you for your message! We'll get back to you soon.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} method="POST">
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Your Full Name"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Your Message
                  </label>
                  <div className="relative">
                    <MessageCircle className="absolute left-3 top-4 text-gray-400" />
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={4}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="How can we help you today?"
                    ></textarea>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Send Message
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default ContactPage;