import './globals.css';
import React from 'react';

export const metadata = {
  title: 'ReachInbox Email Scheduler',
  description: 'Step 0 Project Initialization & Architecture Contract Foundation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
