import { db } from "./server/db";
import { tickets } from "./shared/schema";

async function checkTickets() {
    const allTickets = await db.select().from(tickets);
    console.log("Total tickets:", allTickets.length);
    allTickets.forEach(t => {
        console.log(`ID: ${t.id}, Code: ${t.code}, RequesterId: ${t.requesterId}`);
    });
    process.exit(0);
}

checkTickets().catch(console.error);
