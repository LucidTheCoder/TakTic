import { useEffect, useRef } from 'react';
import { startAmbient, type AmbientHandle } from '../services/audio';

export function useAmbientSound(kind: 'silent' | 'brown' | 'rain'): void {
  const handleRef = useRef<AmbientHandle | null>(null);

  useEffect(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    if (kind === 'silent') return;
    const handle = startAmbient(kind);
    handleRef.current = handle;
    return () => {
      handle?.stop();
      handleRef.current = null;
    };
  }, [kind]);
}
