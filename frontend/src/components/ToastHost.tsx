import { useEffect, useRef, useState } from 'react';
import { __registerToastBus } from '../lib/tx';
import { X } from 'lucide-react';

type ToastKind = 'info' | 'success' | 'error';
type ToastPayload = { kind: ToastKind; title: string; message?: string; linkText?: string; href?: string; persistMs?: number };
type Item = ToastPayload & { id: number };

function kindClasses(kind: ToastKind) {
  switch (kind) {
    case 'success': return 'border-emerald-500/30 bg-emerald-500/10';
    case 'error':   return 'border-red-500/30 bg-red-500/10';
    default:        return 'border-cyan-500/30 bg-cyan-500/10';
  }
}

export default function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(1);

  useEffect(() => {
    __registerToastBus({
      push: (p) => {
        const id = idRef.current++;
        const it: Item = { id, ...p };
        setItems((prev) => [...prev, it]);
        const ms = p.persistMs ?? 5000;
        if (ms > 0) {
          setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), ms);
        }
      },
    });
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-[360px] max-w-[90vw]">
      {items.map((t) => (
        <div key={t.id} className={`border rounded-lg p-3 text-sm text-white backdrop-blur ${kindClasses(t.kind)}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{t.title}</div>
              {t.message && <div className="text-gray-300 mt-1">{t.message}</div>}
              {t.href && t.linkText && (
                <a href={t.href} target="_blank" rel="noreferrer" className="text-cyan-300 hover:underline mt-1 inline-block">
                  {t.linkText}
                </a>
              )}
            </div>
            <button
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-gray-400 hover:text-white">
              <X size={16}/>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
