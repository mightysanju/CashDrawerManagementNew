import React from 'react';
import { Helmet } from 'react-helmet';

export function Header() {
  return (
    <Helmet>
      <title>Cash Drawer Management - Professional Cash Management System</title>
      <meta name="description" content="Professional cash drawer management system for businesses. Track cash, manage shifts, and generate detailed reports. Secure, efficient, and easy to use." />
      <meta name="keywords" content="cash drawer management, cash register, shift management, cash tracking, business management, retail management" />
      <meta name="robots" content="index, follow" />
      <meta property="og:title" content="Cash Drawer Management - Professional Cash Management System" />
      <meta property="og:description" content="Professional cash drawer management system for businesses. Track cash, manage shifts, and generate detailed reports." />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Cash Drawer Management - Professional Cash Management System" />
      <meta name="twitter:description" content="Professional cash drawer management system for businesses. Track cash, manage shifts, and generate detailed reports." />
    </Helmet>
  );
}
export default Header;
