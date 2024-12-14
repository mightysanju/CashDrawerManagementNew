import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { LandingPage } from './components/LandingPage';
import { CashDrawer } from './components/CashDrawer';
import PrivacyPolicy  from './components/PrivacyPolicy';
import ContactPage  from './components/Contact';

function App() {
  return (
    <>
      <Header />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<CashDrawer />} />
          <Route path="/contacts" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;