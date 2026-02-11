
import { db } from "./server/db";
import { settings, users } from "@shared/schema";
import { eq, or } from "drizzle-orm";

async function check() {
    console.log("Checking specific settings...");
    const specificSettings = await db.select().from(settings).where(
        or(
            eq(settings.key, "logo_url_light"),
            eq(settings.key, "logo_url_dark"),
            eq(settings.key, "favicon_url")
        )
    );
    console.log("Specific settings found:", specificSettings);

    console.log("\nChecking specific user...");
    const targetUser = await db.select().from(users).where(eq(users.email, "matheus@renovsmart.com.br"));
    console.log("Target user found:", targetUser);

    if (targetUser.length === 0) {
        console.log("Trying matheus.freitas just in case...");
        const altUser = await db.select().from(users).where(eq(users.email, "matheus.freitas@renovsmart.com.br"));
        console.log("Alt user found:", altUser.map(u => ({ email: u.email, password: u.password })));
    }

    process.exit(0);
}

check().catch(console.error);
