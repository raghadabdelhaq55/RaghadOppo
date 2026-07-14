// Shape DB rows into the JSON the client expects. Money goes out as both cents
// (exact, for math) and a formatted string is left to the client.

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, hasPassword: !!u.password_hash };
}

function memberView(m, balanceCents = 0) {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    joinedAt: m.joined_at,
    balanceCents,
    isShadow: !m.password_hash,
  };
}

function inviteView(i) {
  return { id: i.id, email: i.email, status: i.status, createdAt: i.created_at };
}

function expenseView(e, shares, nameOf) {
  return {
    id: e.id,
    description: e.description,
    payerId: e.payer_id,
    payerName: nameOf(e.payer_id),
    amountCents: e.amount_cents,
    currency: e.currency,
    rateToBase: e.rate_to_base,
    baseAmountCents: Math.round(
      shares.reduce((a, s) => a + s.share_cents, 0) // shares already in base currency
    ),
    splitType: e.split_type,
    date: e.date,
    shares: shares.map((s) => ({ userId: s.user_id, name: nameOf(s.user_id), shareCents: s.share_cents })),
  };
}

function settlementView(s, nameOf) {
  return {
    id: s.id,
    fromUser: s.from_user,
    fromName: nameOf(s.from_user),
    toUser: s.to_user,
    toName: nameOf(s.to_user),
    amountCents: s.amount_cents,
    status: s.status,
    markedBy: s.marked_by,
    createdAt: s.created_at,
    confirmedAt: s.confirmed_at,
  };
}

function paymentView(p, nameOf) {
  return {
    from: p.from,
    to: p.to,
    fromName: nameOf(p.from),
    toName: nameOf(p.to),
    amountCents: p.amountCents,
  };
}

function recurringView(r, instances, nameOf) {
  return {
    id: r.id,
    description: r.description,
    amountCents: r.amount_cents,
    currency: r.currency,
    cadence: r.cadence,
    splitType: r.split_type,
    payerId: r.payer_id,
    payerName: nameOf(r.payer_id),
    nextDue: r.next_due,
    pendingInstances: instances
      .filter((i) => i.recurring_id === r.id)
      .map((i) => ({ id: i.id, dueDate: i.due_date, status: i.status })),
  };
}

module.exports = {
  publicUser,
  memberView,
  inviteView,
  expenseView,
  settlementView,
  paymentView,
  recurringView,
};
