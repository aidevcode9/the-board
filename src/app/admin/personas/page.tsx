import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { PersonaMappingManager } from './persona-mapping-manager';

// Admin Persona Mappings page — server component wraps the interactive client component.

export default async function AdminPersonasPage() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/');

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black text-text-primary">Persona Mappings</h1>
        <p className="font-data mt-1 text-[11px] uppercase tracking-widest text-text-muted">
          Map Analyst / Builder / Synthesizer to provider models
        </p>
      </div>

      <PersonaMappingManager />
    </div>
  );
}
