import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import ToastHost from './ToastHost';
import banner from '../assets/banner.png';

interface LayoutProps {
  children: ReactNode;
  /** Show hero banner under the header (single-page UI) */
  showHero?: boolean;
  /** Optional hero title (only used when showHero = true) */
  heroTitle?: string;
  /** Optional hero subtitle (only used when showHero = true) */
  heroSubtitle?: string;
  /** Header props for navigation */
  headerProps?: {
    currentPage?: 'dashboard' | 'admin' | 'about';
    onPageChange?: (page: 'dashboard' | 'admin' | 'about') => void;
  };
}

export default function Layout({
  children,
  showHero = true,
  heroTitle = '60‑Second Price Pulse',
  heroSubtitle = 'Oracle‑settled rounds on Hedera using Pyth BTC/USD',
  headerProps,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Skip link for accessibility */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-teal-400 focus:text-black"
      >
        Skip to content
      </a>

      <Header {...headerProps} />

      {showHero && (
        <section aria-label="Hero" className="border-b border-white/10">
          <div className="relative">
            {/* Banner image */}
            <img
              src={banner}
              alt="Tatkal60 banner"
              className="w-full h-48 sm:h-64 lg:h-80 xl:h-96 object-cover"
            />
            {/* Subtle gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            {/* Text overlay */}
            <div className="absolute inset-x-0 bottom-0">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-wide">
                  {heroTitle}
                </h2>
                <p className="text-sm sm:text-base text-gray-300">
                  {heroSubtitle}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <main id="main" role="main" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>

      <Footer />
      
      <ToastHost />
    </div>
  );
}