'use client';

import { useEffect } from 'react';
import { createDataClient } from '@/lib/supabase/client';

/**
 * Invisible component that prewarms the Supabase connection on app load.
 * The first Supabase query pays a ~1s TLS/connection setup cost.
 * By firing a tiny query early, all subsequent page queries benefit
 * from the already-established connection.
 */
export default function SupabasePrewarm() {
  useEffect(() => {
    try {
      const client = createDataClient();
      // Fire a minimal query to establish the connection pool
      client.from('shops').select('id').limit(1).then(() => {
        // Connection is now warm — subsequent queries will be ~7x faster
      });
    } catch {
      // Supabase not configured — ignore
    }
  }, []);

  return null;
}
