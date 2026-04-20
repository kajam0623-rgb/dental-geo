'use client';

import { useEffect } from 'react';
import * as amplitude from '@amplitude/unified';

let isInitialized = false;

export default function AmplitudeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isInitialized) {
      amplitude.initAll('d5fdb795be3d28f6a5add439cfa6f829', {
        analytics: { autocapture: true },
        sessionReplay: { sampleRate: 1 },
      });
      isInitialized = true;
    }
  }, []);

  return <>{children}</>;
}
