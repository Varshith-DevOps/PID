'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/authContext';
import { createHelpdeskTicket, getHelpdeskTickets } from '@/lib/api';

export default function HelpdeskPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [form, setForm] = useState({ category: 'HR', subject: '', description: '', priority: 'MEDIUM' });

  useEffect(() => {
    if (!authLoading && !user) router.push('/');
  }, [user, authLoading, router]);

  const loadTickets = async () => setTickets(await getHelpdeskTickets());
  useEffect(() => { if (user) loadTickets(); }, [user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createHelpdeskTicket(form);
    setForm({ category: 'HR', subject: '', description: '', priority: 'MEDIUM' });
    loadTickets();
  };

  if (!user) return null;

  return (
    <div className="app-layout">
      <Sidebar activePath="/helpdesk" />
      <main className="main-content">
        <div className="page-header"><h1>HR Helpdesk</h1></div>
        <div className="grid grid-2">
          <section className="card">
            <h2>New Ticket</h2>
            <form onSubmit={submit} className="form-grid">
              <select className="form-control" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                <option>HR</option><option>Payroll</option><option>IT</option><option>Admin</option>
              </select>
              <select className="form-control" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option>
              </select>
              <input className="form-control" placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
              <textarea className="form-control" placeholder="Describe the issue" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
              <button className="btn btn-primary" type="submit">Create Ticket</button>
            </form>
          </section>
          <section className="card">
            <h2>Tickets</h2>
            <div className="stack">
              {tickets.map(ticket => (
                <div key={ticket.id} className="list-item">
                  <strong>{ticket.subject}</strong>
                  <span>{ticket.category} &middot; {ticket.priority} &middot; {ticket.status}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
