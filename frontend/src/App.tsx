import Layout from './components/Layout';
import LivePrice from './components/LivePrice';
import RefreshPyth from './components/RefreshPyth';
import RoundsList from './components/RoundsList';

export default function App() {
  return (
    <Layout>
      <section className="flex items-center justify-center py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-4">
            Tatkal60
          </h1>
          <p className="text-base sm:text-lg text-gray-300">
            Oracle‑settled UP/DOWN micro‑market on Hedera
          </p>
        </div>
      </section>
      
      <div className="grid gap-6">
        <LivePrice />
        <RefreshPyth />
        <RoundsList />
      </div>
    </Layout>
  );
}
