import { redirect } from 'next/navigation';

// Admin index — redirect to users management page.
export default function AdminPage() {
  redirect('/admin/users');
}
