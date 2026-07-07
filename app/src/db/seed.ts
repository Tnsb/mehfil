/**
 * Demo seed: one host with an upcoming dinner, a sold-out dinner with a
 * waitlist, and a completed dinner with AfterParty feedback.
 * Run: npm run seed   (wipes existing data)
 *
 * Sign in as the host with maya@table.demo (the dev code shows on screen).
 */
import { db, tables } from "./index";
import { newId } from "../lib/ids";
import { assignPersona, assignBringItem } from "../cohost/vibes";
import { matchThread } from "../lib/taps";

function daysFromNow(days: number, hour = 19): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** placeholder "One Shot" — a warm gradient polaroid as an SVG data URL */
function demoShot(from: string, to: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><text x="300" y="330" font-size="160" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function main() {
  // wipe (order matters for FKs)
  await db.delete(tables.connections);
  await db.delete(tables.photos);
  await db.delete(tables.messages);
  await db.delete(tables.feedback);
  await db.delete(tables.notifications);
  await db.delete(tables.domainEvents);
  await db.delete(tables.tickets);
  await db.delete(tables.events);
  await db.delete(tables.sessions);
  await db.delete(tables.authCodes);
  await db.delete(tables.users);

  const mkUser = async (email: string, name: string) => {
    const [u] = await db.insert(tables.users).values({ id: newId("usr"), email, name }).returning();
    return u;
  };

  const maya = await mkUser("maya@table.demo", "Maya");
  const leo = await mkUser("leo@table.demo", "Leo");
  const priya = await mkUser("priya@table.demo", "Priya");
  const sam = await mkUser("sam@table.demo", "Sam");
  const noor = await mkUser("noor@table.demo", "Noor");

  const dietary = [{ key: "dietary", label: "Any dietary restrictions or allergies?" }];

  /* upcoming, published, seats open */
  const oaxaca = newId("evt");
  await db.insert(tables.events).values({
    id: oaxaca,
    hostId: maya.id,
    title: "Six-Course Oaxacan Night",
    vibe: "mole from scratch, mezcal pairings, strangers welcome",
    description:
      "I spent a month in Oaxaca learning mole negro from a family that's made it for four generations. Six courses, communal table, ten seats.\n\nBring nothing but an appetite and one good story.",
    priceCents: 8500,
    capacity: 10,
    startsAt: daysFromNow(4),
    status: "published",
    locationHint: "Silver Lake — exact address after booking",
    locationAddress: "2114 Echo Park Ave, Los Angeles",
    questions: dietary,
    tosAcceptedAt: new Date(),
  });
  const t1 = newId("tkt");
  const t2 = newId("tkt");
  await db.insert(tables.tickets).values([
    { id: t1, eventId: oaxaca, userId: leo.id, status: "paid", paidAt: daysFromNow(-1), answers: { dietary: "no shellfish" }, persona: assignPersona(t1), bringItem: assignBringItem(t1) },
    { id: t2, eventId: oaxaca, userId: priya.id, status: "paid", paidAt: daysFromNow(-1), answers: { dietary: "vegetarian" }, persona: assignPersona(t2), bringItem: assignBringItem(t2) },
  ]);

  /* a party chat already warming up (the Cohost is a chaotic bestie) */
  await db.insert(tables.messages).values([
    { id: newId("msg"), eventId: oaxaca, userId: null, kind: "cohost", body: "LEO IS COMING!!! ok listen leo, you're bringing your assigned item (check your card) and this is already the best night of my life" },
    { id: newId("msg"), eventId: oaxaca, userId: leo.id, kind: "chat", body: "hyped for the mole 🔥 what should I wear?" },
    { id: newId("msg"), eventId: oaxaca, userId: null, kind: "cohost", body: "something you can spill mezcal on with DIGNITY. so: anything. see you saturday" },
    { id: newId("msg"), eventId: oaxaca, userId: priya.id, kind: "chat", body: "veggie mole confirmed?? maya you're the best" },
  ]);

  /* upcoming, sold out, with waitlist */
  const wine = newId("evt");
  await db.insert(tables.events).values({
    id: wine,
    hostId: maya.id,
    title: "Natural Wine & Handmade Dumplings",
    vibe: "four wines, forty dumplings, one long table",
    priceCents: 4500,
    capacity: 2,
    startsAt: daysFromNow(7, 18),
    status: "sold_out",
    locationHint: "Echo Park — address after booking",
    locationAddress: "1560 Lemoyne St, Los Angeles",
    questions: dietary,
    tosAcceptedAt: new Date(),
  });
  await db.insert(tables.tickets).values([
    { id: newId("tkt"), eventId: wine, userId: sam.id, status: "paid", paidAt: daysFromNow(-2), answers: {} },
    { id: newId("tkt"), eventId: wine, userId: noor.id, status: "paid", paidAt: daysFromNow(-2), answers: { dietary: "gluten-free" } },
    { id: newId("tkt"), eventId: wine, userId: leo.id, status: "waitlisted", answers: {} },
  ]);

  /*
   * Last night's dinner, completed this morning — so the AfterParty Drop is
   * fresh and the 48h Taps window is OPEN in the demo.
   */
  const completedThisMorning = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const ramen = newId("evt");
  await db.insert(tables.events).values({
    id: ramen,
    hostId: maya.id,
    title: "Backyard Ramen Night",
    vibe: "18-hour tonkotsu under string lights",
    priceCents: 4000,
    capacity: 8,
    startsAt: daysFromNow(-1),
    status: "completed",
    completedAt: completedThisMorning,
    locationHint: "Los Feliz",
    locationAddress: "4722 Franklin Ave, Los Angeles",
    questions: dietary,
    tosAcceptedAt: new Date(),
  });
  const rt1 = newId("tkt");
  const rt2 = newId("tkt");
  const rt3 = newId("tkt");
  await db.insert(tables.tickets).values([
    { id: rt1, eventId: ramen, userId: leo.id, status: "paid", paidAt: daysFromNow(-3), answers: {}, persona: assignPersona(rt1), bringItem: assignBringItem(rt1) },
    { id: rt2, eventId: ramen, userId: sam.id, status: "paid", paidAt: daysFromNow(-3), answers: {}, persona: assignPersona(rt2), bringItem: assignBringItem(rt2) },
    { id: rt3, eventId: ramen, userId: priya.id, status: "paid", paidAt: daysFromNow(-3), answers: { dietary: "vegetarian" }, persona: assignPersona(rt3), bringItem: assignBringItem(rt3) },
  ]);

  /* the developed One Shot roll from ramen night */
  await db.insert(tables.photos).values([
    { id: newId("pht"), eventId: ramen, ticketId: rt1, userId: leo.id, dataUrl: demoShot("#ff7847", "#8b5cf6", "🍜"), caption: "the 18-hour broth moment", createdAt: daysFromNow(-1, 21) },
    { id: newId("pht"), eventId: ramen, ticketId: rt2, userId: sam.id, dataUrl: demoShot("#0ea5e9", "#f59e0b", "🏮"), caption: "string lights doing their thing", createdAt: daysFromNow(-1, 22) },
    { id: newId("pht"), eventId: ramen, ticketId: `host_${ramen}`, userId: maya.id, dataUrl: demoShot("#10b981", "#ec4899", "🥢"), caption: "eight strangers, one pot", createdAt: daysFromNow(-1, 23) },
  ]);

  /* the Cohost ran the night in the chat */
  await db.insert(tables.messages).values([
    { id: newId("msg"), eventId: ramen, userId: null, kind: "cohost", body: "24 HOURS until Backyard Ramen Night!!! hydrate. charge your phone. you get ONE photo tomorrow, make it count 📸", createdAt: daysFromNow(-2) },
    { id: newId("msg"), eventId: ramen, userId: sam.id, kind: "chat", body: "what's the address again? 😅", createdAt: daysFromNow(-1, 18) },
    { id: newId("msg"), eventId: ramen, userId: null, kind: "cohost", body: "for the 100th time (love you): 4722 Franklin Ave, Los Angeles 📍", createdAt: daysFromNow(-1, 18) },
    { id: newId("msg"), eventId: ramen, userId: null, kind: "cohost", body: "ok the votes are in 🏆\n🏆 MVP of the night: Maya\n😂 Funniest single sentence: Sam\n🕺 Most likely to start the dancing: Leo\nno appeals. court is adjourned.", createdAt: completedThisMorning },
  ]);

  /*
   * Taps (double-blind, intent-matched):
   * - Leo ⚡ Sam matched on Collab — the Cohost opened their chat.
   * - Priya tapped Leo as 💘 Crush; still sealed. If Leo taps her back as
   *   Crush during the demo, it matches live.
   */
  await db.insert(tables.connections).values([
    { id: newId("con"), eventId: ramen, fromUserId: leo.id, toUserId: sam.id, intent: "collab", createdAt: new Date(completedThisMorning.getTime() + 30 * 60 * 1000) },
    { id: newId("con"), eventId: ramen, fromUserId: sam.id, toUserId: leo.id, intent: "collab", createdAt: new Date(completedThisMorning.getTime() + 90 * 60 * 1000) },
    { id: newId("con"), eventId: ramen, fromUserId: priya.id, toUserId: leo.id, intent: "crush", createdAt: new Date(completedThisMorning.getTime() + 60 * 60 * 1000) },
  ]);
  await db.insert(tables.messages).values([
    {
      id: newId("msg"),
      eventId: ramen,
      thread: matchThread(leo.id, sam.id),
      userId: null,
      kind: "cohost",
      body: "Leo + Sam — mutual ⚡ Collab tap. Receipts from the night: Leo's One Shot: \"the 18-hour broth moment\" · Sam's One Shot: \"string lights doing their thing\". Consider this your first standup. What are you building?",
      createdAt: new Date(completedThisMorning.getTime() + 90 * 60 * 1000),
    },
    {
      id: newId("msg"),
      eventId: ramen,
      thread: matchThread(leo.id, sam.id),
      userId: sam.id,
      kind: "chat",
      body: "ok so that ramen pop-up idea from last night... I wasn't joking",
      createdAt: new Date(completedThisMorning.getTime() + 2 * 60 * 60 * 1000),
    },
  ]);
  await db.insert(tables.feedback).values([
    { id: newId("fbk"), ticketId: rt1, eventId: ramen, userId: leo.id, rating: 5, comment: "Best broth of my life. Take my money for the next one." },
    { id: newId("fbk"), ticketId: rt2, eventId: ramen, userId: sam.id, rating: 5, comment: "Met three people I actually want to see again." },
    { id: newId("fbk"), ticketId: rt3, eventId: ramen, userId: priya.id, rating: 3, comment: "Veggie option felt like an afterthought — the broth crew got the show." },
  ]);

  /* a little activity-log + inbox realism for the host */
  await db.insert(tables.domainEvents).values([
    { id: newId("dev"), type: "event.published", actorId: maya.id, subjectType: "event", subjectId: ramen, payload: { title: "Backyard Ramen Night" } },
    { id: newId("dev"), type: "afterparty.fired", actorId: null, subjectType: "event", subjectId: ramen, payload: { title: "Backyard Ramen Night" } },
    { id: newId("dev"), type: "event.published", actorId: maya.id, subjectType: "event", subjectId: oaxaca, payload: { title: "Six-Course Oaxacan Night" } },
    { id: newId("dev"), type: "ticket.paid", actorId: leo.id, subjectType: "ticket", subjectId: t1, payload: { eventId: oaxaca, eventTitle: "Six-Course Oaxacan Night" } },
    { id: newId("dev"), type: "ticket.paid", actorId: priya.id, subjectType: "ticket", subjectId: t2, payload: { eventId: oaxaca, eventTitle: "Six-Course Oaxacan Night" } },
  ]);
  await db.insert(tables.notifications).values([
    {
      id: newId("ntf"),
      userId: maya.id,
      channel: "in_app",
      templateKey: "host.feedback",
      title: "★★★★★ — Backyard Ramen Night",
      body: "A guest loved it. See your AfterParty summary.",
      href: `/host/events/${ramen}`,
      status: "sent",
      sentAt: completedThisMorning,
    },
    {
      id: newId("ntf"),
      userId: maya.id,
      channel: "in_app",
      templateKey: "host.seat_sold",
      title: "Seat sold — Six-Course Oaxacan Night",
      body: "A guest just booked. Check your roster.",
      href: `/host/events/${oaxaca}`,
      status: "sent",
      sentAt: daysFromNow(-1),
    },
  ]);

  console.log("Seeded ✓");
  console.log("  Host login:  maya@table.demo  (dev code appears on the login screen)");
  console.log("  Guest login: leo@table.demo / priya@table.demo / sam@table.demo");
  console.log(`  Upcoming event: /e/${oaxaca}`);
  console.log(`  Party chat (as leo/priya/maya): /party/${oaxaca}`);
  console.log(`  AfterParty Drop: /drop/${ramen}`);
  console.log(`  Completed event w/ AfterParty: /host/events/${ramen}`);
}

main().then(() => process.exit(0));
