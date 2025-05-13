// components/shared/Layout.tsx - Make sure it's exported correctly
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}

// Make sure this is a proper function component with default export
export default function Layout({
  children,
  title = 'Fantasy Football Auction Draft',
  description = 'Customizable fantasy football auction draft platform for Sleeper leagues',
  showHeader = true,
  showFooter = true,
}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      {showHeader && (
        <header className="bg-indigo-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Link href="/" legacyBehavior>
                  <a className="flex-shrink-0">
                    <span className="text-white font-bold text-xl">Fantasy Auction Draft</span>
                  </a>
                </Link>
              </div>
              <div className="flex">
                <nav className="flex space-x-4">
                  <Link href="/" legacyBehavior>
                    <a className="text-white hover:bg-indigo-700 px-3 py-2 rounded-md text-sm font-medium">
                      Home
                    </a>
                  </Link>
                  <Link href="/setup" legacyBehavior>
                    <a className="text-white hover:bg-indigo-700 px-3 py-2 rounded-md text-sm font-medium">
                      Create Auction
                    </a>
                  </Link>
                  <Link href="/join" legacyBehavior>
                    <a className="text-white hover:bg-indigo-700 px-3 py-2 rounded-md text-sm font-medium">
                      Join Auction
                    </a>
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </header>
      )}

      <main className="flex-grow">
        {children}
      </main>

      {showFooter && (
        <footer className="bg-white">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Fantasy Auction Draft. All rights reserved.
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}