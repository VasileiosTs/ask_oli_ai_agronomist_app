import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { trackError } from '../lib/sentry';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Warn in development if VAPID key is missing — push notifications will silently
// fail for all users if VITE_VAPID_PUBLIC_KEY is not set in Vercel environment variables.
if (!VAPID_PUBLIC_KEY && import.meta.env.DEV) {
  console.warn(
    '[Oli] VITE_VAPID_PUBLIC_KEY is not set. Push notifications (VIO follow-up reminders) are disabled.\n' +
    'Generate keys: npx web-push generate-vapid-keys\n' +
    'Add VITE_VAPID_PUBLIC_KEY to Vercel env vars and VAPID_PRIVATE_KEY to Supabase Edge Function secrets.'
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushSubscription(userId: string | null) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && !!VAPID_PUBLIC_KEY;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);

    // Check existing subscription
    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setIsSubscribed(!!sub);
      }).catch(() => { /* permission denied or SW not active */ });
    }).catch(() => { /* SW not registered */ });
  }, []);

  const subscribe = useCallback(async () => {
    if (!userId || !isSupported) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return false; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();

      // Enforce max 5 subscriptions per user
      const MAX_SUBSCRIPTIONS = 5;
      const { count } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if ((count ?? 0) >= MAX_SUBSCRIPTIONS) {
        // Delete oldest subscription to make room
        const { data: oldest } = await supabase
          .from('push_subscriptions')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        if (oldest) {
          await supabase.from('push_subscriptions').delete().eq('id', oldest.id);
        }
      }

      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh!,
        auth: json.keys!.auth!,
      }, { onConflict: 'user_id,endpoint' });

      if (error) throw error;
      setIsSubscribed(true);
      return true;
    } catch (e) {
      trackError(e, {
        type: 'push_notification',
        phase: 'subscribe',
        userId,
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Remove from DB
        await supabase.from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (e) {
      trackError(e, {
        type: 'push_notification',
        phase: 'unsubscribe',
        userId,
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { isSubscribed, isSupported, permission, loading, subscribe, unsubscribe };
}
