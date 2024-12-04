import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { LandingPage } from './components/LandingPage';
import { CashDrawer } from './components/CashDrawer';

function App() {
  return (
    <>
      <Header />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<CashDrawer />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;