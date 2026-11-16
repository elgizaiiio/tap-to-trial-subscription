import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'si.ceyo.app',
  appName: 'Ceyo',
  webDir: 'native-shell',
  server: { url: 'https://tap-to-trial-subscription.lovable.app', cleartext: false },
  android: { allowMixedContent: false, backgroundColor: '#000000' },
};
export default config;
