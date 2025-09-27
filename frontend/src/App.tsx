import { useState } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import About from './pages/About';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'admin' | 'about'>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'admin':
        return <AdminPanel />;
      case 'about':
        return <About />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout 
      showHero={false}
      headerProps={{
        currentPage,
        onPageChange: setCurrentPage
      }}
    >
      {renderPage()}
    </Layout>
  );
}
