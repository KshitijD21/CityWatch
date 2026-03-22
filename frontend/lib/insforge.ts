import InsForge from '@insforge/sdk';

const insforgeUrl = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const insforgeAnonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

export const insforge = new InsForge({
  baseUrl: insforgeUrl,
  anonKey: insforgeAnonKey,
});
