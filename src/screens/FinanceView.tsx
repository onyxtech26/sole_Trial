import { useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import {
  Btn, C, Card, Empty, Hov, Input, Label, MONO, Modal, ModalFoot, ModalHead,
  Section, SectionHead, Select, Textarea, useToast,
} from '../ui/kit';
import { commit } from '../lib/store';
import { uploadFile } from '../lib/upload';
import { eur, rangeLabelFor, short, uid } from '../utils/dates';
import { netOf, paxOf, productName, refundOf, refundTotal } from '../utils/selectors';
import { download, reportPdf, toCsv, writeWorkbook } from '../utils/exports';
import { RollingNumber } from '../ui/RollingNumber';
import type { Expense, ExpenseCategory } from '../types';
import type { ViewProps } from './types';

const CATEGORIES: ExpenseCategory[] = ['Guide', 'Ticket', 'Radio', 'Staff Salary', 'Other'];

const CAT_COLORS: Record<string, string> = {
  Guide: '#1f4e8c', Ticket: '#0f6b48', Radio: '#8a5106',
  'Staff Salary': '#5b3fa8', Other: '#5b6472',
};

export function FinanceView({ store, range, rangeValue, user, setConfirm }: ViewProps) {
  const toast = useToast();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isManager = user.role === 'manager';

  const bookings = useMemo(
    () => store.bookings.filter(b =>
      b.date >= rangeValue[0] && b.date <= rangeValue[1] && b.status !== 'Cancelled'),
    [store.bookings, rangeValue],
  );

  const expenses = useMemo(
    () => store.expenses
      .filter(e => e.date >= rangeValue[0] && e.date <= rangeValue[1])
      .sort((a, b) => b.date.localeCompare(a.date)),
    [store.expenses, rangeValue],
  );

  // Refunds come off the top: money handed back was never earned.
  const gross = bookings.reduce((n, b) => n + b.gross, 0);
  const refunded = refundTotal(bookings);
  const revenue = gross - refunded;
  const bookingCost = bookings.reduce((n, b) => n + b.spent, 0);
  const approved = expenses.filter(e => e.status === 'Approved').reduce((n, e) => n + e.amount, 0);
  const pending = expenses.filter(e => e.status === 'Pending').reduce((n, e) => n + e.amount, 0);
  const cost = bookingCost + approved;
  const balance = revenue - cost;
  const margin = revenue > 0 ? (balance / revenue) * 100 : 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      if (e.status !== 'Approved') continue;
      const key = e.cat === 'Other' && e.customCat ? e.customCat : e.cat;
      m.set(key, (m.get(key) ?? 0) + e.amount);
    }
    if (bookingCost > 0) m.set('Booked against tours', bookingCost);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, bookingCost]);

  const unpaid = useMemo(
    () => bookings.filter(b => b.payment !== 'Paid'),
    [bookings],
  );

  const saveExpense = () => {
    if (!editing) return;
    if (!editing.desc.trim()) { toast('Add a short description.', 'bad'); return; }
    if (!editing.amount) { toast('Enter an amount.', 'bad'); return; }
    const exists = store.expenses.some(e => e.id === editing.id);
    commit({
      expenses: exists
        ? store.expenses.map(e => (e.id === editing.id ? editing : e))
        : [...store.expenses, editing],
    });
    setEditing(null);
    toast(exists ? 'Expense saved' : 'Expense recorded');
  };

  const attachReceipt = async (file: File | undefined) => {
    if (!file || !editing) return;
    setUploading(true);
    try {
      const url = await uploadFile('receipts', file);
      setEditing({ ...editing, receiptUrl: url });
      toast('Receipt attached');
    } catch (e) {
      toast((e as Error).message || 'Upload failed', 'bad');
    } finally {
      setUploading(false);
    }
  };

  const exportPdf = async () => {
    setBusy(true);
    try {
      const blob = await reportPdf(
        'Finance report',
        rangeLabelFor(range.mode, range.anchor, range.end),
        [
          {
            title: 'Summary',
            head: ['Metric', 'Value'],
            rows: [
              ['Gross bookings', eur(gross)],
              ['Refunded', `-${eur(refunded)}`],
              ['Revenue', eur(revenue)],
              ['Cost booked against tours', eur(bookingCost)],
              ['Approved expenses', eur(approved)],
              ['Pending expenses (excluded)', eur(pending)],
              ['Balance', eur(balance)],
              ['Margin', `${margin.toFixed(1)}%`],
            ],
          },
          {
            title: 'Expenses',
            head: ['Date', 'Category', 'Description', 'Status', 'Amount'],
            rows: expenses.map(e => [
              e.date, e.cat === 'Other' && e.customCat ? e.customCat : e.cat,
              e.desc, e.status, eur(e.amount),
            ]),
          },
          {
            title: 'Bookings',
            head: ['Reference', 'Date', 'Tour', 'Pax', 'Payment', 'Gross', 'Refund', 'Revenue', 'Cost'],
            rows: bookings.map(b => [
              b.ref, b.date, productName(store.products, b), paxOf(b),
              b.payment, eur(b.gross), eur(refundOf(b)), eur(netOf(b)), eur(b.spent),
            ]),
          },
        ],
      );
      download(`sole-finance-${rangeValue[0]}.pdf`, blob, 'application/pdf');
      toast('Finance PDF saved');
    } catch (e) {
      toast((e as Error).message || 'Could not build the PDF', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const exportXlsx = async () => {
    await writeWorkbook(`sole-finance-${rangeValue[0]}.xlsx`, [
      {
        name: 'Expenses',
        head: ['ID', 'Date', 'Category', 'Description', 'Status', 'Amount', 'Receipt'],
        rows: expenses.map(e => [
          e.id, e.date, e.cat === 'Other' && e.customCat ? e.customCat : e.cat,
          e.desc, e.status, e.amount, e.receiptUrl,
        ]),
      },
      {
        name: 'Bookings',
        head: ['Reference', 'Date', 'Tour', 'Pax', 'Guide', 'Payment', 'Gross', 'Refund', 'Revenue', 'Cost'],
        rows: bookings.map(b => [
          b.ref, b.date, productName(store.products, b), paxOf(b),
          b.guide, b.payment, b.gross, refundOf(b), netOf(b), b.spent,
        ]),
      },
    ]);
    toast('Workbook saved');
  };

  if (!isManager) {
    return (
      <Section style={{
        borderColor: C.badLine, padding: 34, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 9, textAlign: 'center',
      }}>
        <Icon name="lock" size={22} color={C.bad} />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.bad }}>
          Finance is closed for this account
        </h2>
        <p style={{
          margin: 0, maxWidth: 340, fontSize: 12, color: C.muted2,
          lineHeight: 1.55, textWrap: 'pretty',
        }}>
          Revenue, cost and expenses are visible to managers only — the database enforces this,
          not just this screen. Ask an owner to change your role.
        </p>
      </Section>
    );
  }

  return (
    <>
      <div data-r="g4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {/* The note carries the refund so the figure can be reconciled against a
            payout report without anyone having to work out the difference. */}
        <Money
          label="Revenue"
          value={revenue}
          note={refunded > 0
            ? `${bookings.length} bookings · ${eur(gross)} less ${eur(refunded)} refunded`
            : `${bookings.length} bookings`}
        />
        <Money label="Cost" value={cost} note={`${eur(bookingCost)} tours · ${eur(approved)} expenses`} fg={C.bad} />
        <Money
          label="Balance"
          value={balance}
          note={`${margin.toFixed(1)}% margin`}
          fg={balance >= 0 ? C.good : C.bad}
        />
        <Money label="Pending approval" value={pending} note="excluded from the balance" fg={C.warn} />
      </div>

      <div data-r="split" style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)',
        gap: 14, alignItems: 'start',
      }}>
        <Section>
          <SectionHead title="Expenses" note={rangeLabelFor(range.mode, range.anchor, range.end)}>
            <Btn small icon="download" onClick={exportXlsx}>Excel</Btn>
            <Btn small icon={busy ? 'spinner' : 'fileText'} onClick={exportPdf} disabled={busy}>
              PDF
            </Btn>
            <Btn
              small
              variant="primary"
              icon="plus"
              onClick={() => setEditing({
                id: uid('EXP'), cat: 'Guide', customCat: '', amount: 0,
                date: rangeValue[0], desc: '', status: 'Pending', receiptUrl: '',
              })}
            >
              Record
            </Btn>
          </SectionHead>

          {!expenses.length && <Empty pad={34}>No expenses recorded in this period.</Empty>}

          {expenses.map(e => (
            <Hov
              key={e.id}
              as="div"
              className="row"
              data-r="listrow"
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 15px',
                borderBottom: `1px solid ${C.lineFaint}`,
              }}
              hover={{ background: C.wash }}
            >
              <span style={{
                width: 3, height: 26, borderRadius: 2, flexShrink: 0,
                background: CAT_COLORS[e.cat] ?? C.muted,
              }} />
              <span style={{
                width: 48, flexShrink: 0, fontSize: 11.5, fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {short(e.date)}
              </span>
              <span style={{ width: 104, flexShrink: 0, fontSize: 11.5, color: C.muted2 }}>
                {e.cat === 'Other' && e.customCat ? e.customCat : e.cat}
              </span>
              <span data-grow style={{
                flex: 1, minWidth: 0, fontSize: 12, whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {e.desc}
              </span>

              {e.receiptUrl && (
                <a
                  href={e.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open the receipt"
                  style={{ display: 'flex', alignItems: 'center', color: C.muted, flexShrink: 0 }}
                >
                  <Icon name="paperclip" size={12} />
                </a>
              )}

              <Hov
                as="button"
                type="button"
                title="Approve or hold"
                onClick={() => commit({
                  expenses: store.expenses.map(x => x.id === e.id
                    ? { ...x, status: x.status === 'Approved' ? 'Pending' : 'Approved' }
                    : x),
                })}
                style={{
                  border: 0, fontSize: 10.5, fontWeight: 600, borderRadius: 11,
                  padding: '2px 8px', cursor: 'pointer', flexShrink: 0,
                  background: e.status === 'Approved' ? C.goodBg : C.warnBg,
                  color: e.status === 'Approved' ? C.good : C.warn,
                }}
                hover={{ opacity: 0.82 }}
              >
                {e.status}
              </Hov>

              <span style={{
                width: 88, flexShrink: 0, textAlign: 'right', fontFamily: MONO,
                fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              }}>
                {eur(e.amount)}
              </span>

              <div className="row-actions" style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <Hov
                  as="button" type="button" title="Edit"
                  onClick={() => setEditing({ ...e })}
                  style={iconBtn} hover={{ borderColor: C.accent, color: C.ink }}
                >
                  <Icon name="edit" size={12} />
                </Hov>
                <Hov
                  as="button" type="button" title="Delete"
                  onClick={() => setConfirm({
                    title: 'Delete this expense?',
                    body: `${e.desc} · ${eur(e.amount)}. This cannot be undone.`,
                    confirmLabel: 'Delete',
                    tone: 'danger',
                    run: () => {
                      commit({ expenses: store.expenses.filter(x => x.id !== e.id) });
                      toast('Expense deleted');
                    },
                  })}
                  style={iconBtn} hover={{ borderColor: '#e0a3b3', color: C.bad }}
                >
                  <Icon name="trash" size={12} />
                </Hov>
              </div>
            </Hov>
          ))}
        </Section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Section style={{ padding: '14px 15px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 600 }}>
              Where the money goes
            </h2>
            {!byCategory.length && (
              <p style={{ margin: 0, fontSize: 11.5, color: C.muted }}>
                No approved cost in this period.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {byCategory.map(([name, amount]) => {
                const pct = cost > 0 ? Math.round((amount / cost) * 100) : 0;
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{
                      width: 118, flexShrink: 0, fontSize: 11.5, color: C.body,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {name}
                    </span>
                    <div style={{
                      flex: 1, height: 5, borderRadius: 3, background: '#f0f2f5', overflow: 'hidden',
                    }}>
                      <div
                        className="bar"
                        style={{
                          height: '100%', borderRadius: 3, width: `${pct}%`,
                          background: CAT_COLORS[name] ?? C.ink,
                          transition: 'width .5s cubic-bezier(.16,1,.3,1)',
                        }}
                      />
                    </div>
                    <RollingNumber
                      value={amount}
                      prefix="€"
                      decimals={2}
                      style={{
                        width: 70, textAlign: 'right', fontFamily: MONO, fontSize: 11,
                        color: C.muted2, flexShrink: 0,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </Section>

          <Section>
            <SectionHead title="Not fully paid" note={`${unpaid.length} bookings`}>
              <Btn
                small
                icon="download"
                onClick={() => {
                  download(
                    `sole-unpaid-${rangeValue[0]}.csv`,
                    toCsv([
                      ['Reference', 'Date', 'Tour', 'Lead', 'Payment', 'Amount'],
                      ...unpaid.map(b => [
                        b.ref, b.date, productName(store.products, b),
                        b.travelers[0]?.[0] ?? '', b.payment, b.gross,
                      ]),
                    ]),
                  );
                  toast('Saved');
                }}
              >
                CSV
              </Btn>
            </SectionHead>

            {!unpaid.length && <Empty pad={22}>Everything in this period is paid.</Empty>}

            {unpaid.slice(0, 10).map(b => (
              <div key={b.ref} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 15px',
                borderBottom: `1px solid ${C.lineFaint}`,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.faint, width: 96, flexShrink: 0 }}>
                  {b.ref}
                </span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 11.5, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {b.travelers[0]?.[0] ?? '—'}
                </span>
                <span style={{
                  fontSize: 10.5, fontWeight: 600, borderRadius: 11, padding: '1px 7px',
                  background: C.badBg, color: C.bad, flexShrink: 0,
                }}>
                  {b.payment}
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 11.5, fontWeight: 600, width: 74,
                  textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums',
                }}>
                  {eur(b.gross)}
                </span>
              </div>
            ))}
          </Section>
        </div>
      </div>

      {/* ── expense editor ── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} width={470}>
        {editing && (
          <>
            <ModalHead
              title={store.expenses.some(e => e.id === editing.id) ? 'Edit expense' : 'Record an expense'}
              sub="Pending costs stay out of the balance until an owner approves them."
              onClose={() => setEditing(null)}
            />
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div data-r="fields" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Fld label="Date">
                  <Input
                    type="date"
                    value={editing.date}
                    onChange={(e: any) => setEditing({ ...editing, date: e.target.value })}
                    style={{ width: 148 }}
                  />
                </Fld>
                <Fld label="Category">
                  <Select
                    value={editing.cat}
                    onChange={(e: any) => setEditing({ ...editing, cat: e.target.value as ExpenseCategory })}
                    options={CATEGORIES.map(c => ({ v: c, t: c }))}
                    style={{ width: 148, background: C.panel }}
                  />
                </Fld>
                <Fld label="Amount (€)" grow>
                  <Input
                    type="number"
                    step="0.01"
                    value={String(editing.amount)}
                    onChange={(e: any) => setEditing({ ...editing, amount: Number(e.target.value) || 0 })}
                  />
                </Fld>
              </div>

              {editing.cat === 'Other' && (
                <Fld label="Custom category">
                  <Input
                    value={editing.customCat}
                    onChange={(e: any) => setEditing({ ...editing, customCat: e.target.value })}
                    placeholder="Signage, parking, insurance…"
                  />
                </Fld>
              )}

              <Fld label="Description">
                <Textarea
                  value={editing.desc}
                  onChange={(e: any) => setEditing({ ...editing, desc: e.target.value })}
                  placeholder="What was bought, and for which tour"
                  style={{ minHeight: 60 }}
                />
              </Fld>

              <div data-r="fields" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Fld label="Status">
                  <Select
                    value={editing.status}
                    onChange={(e: any) => setEditing({ ...editing, status: e.target.value as Expense['status'] })}
                    options={[{ v: 'Pending', t: 'Pending' }, { v: 'Approved', t: 'Approved' }]}
                    style={{ width: 148, background: C.panel }}
                  />
                </Fld>

                <Btn
                  icon={uploading ? 'spinner' : 'paperclip'}
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  style={{ height: 30 }}
                >
                  {uploading ? 'Uploading…' : editing.receiptUrl ? 'Replace receipt' : 'Attach receipt'}
                </Btn>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => { void attachReceipt(e.target.files?.[0]); e.target.value = ''; }}
                />

                {editing.receiptUrl && (
                  <a
                    href={editing.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11.5, alignSelf: 'center' }}
                  >
                    View attached receipt
                  </a>
                )}
              </div>
            </div>
            <ModalFoot>
              <Btn onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={saveExpense}>Save</Btn>
            </ModalFoot>
          </>
        )}
      </Modal>
    </>
  );
}

function Money({
  label, value, note, fg = C.ink,
}: { label: string; value: number; note: string; fg?: string }) {
  return (
    <Card style={{ padding: '13px 15px' }}>
      <Label style={{ display: 'block', marginBottom: 9 }}>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <RollingNumber
          value={value}
          prefix="€"
          decimals={2}
          style={{
            fontSize: 23, fontWeight: 600, letterSpacing: '-.02em',
            lineHeight: 1, color: fg,
          }}
        />
      </div>
      <span style={{ display: 'block', marginTop: 6, fontSize: 10.5, color: C.muted }}>{note}</span>
    </Card>
  );
}

const iconBtn: React.CSSProperties = {
  width: 24, height: 24, border: `1px solid ${C.line}`, background: C.panel,
  borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: C.body, padding: 0,
};

function Fld({
  label, children, grow,
}: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      flex: grow ? 1 : undefined, minWidth: grow ? 140 : undefined,
    }}>
      <span style={{
        fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em',
        textTransform: 'uppercase', color: C.muted3,
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}
