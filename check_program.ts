import admin from 'firebase-admin';
import fs from 'fs';

async function main() {
    try {
        const serviceAccount = JSON.parse(
            fs.readFileSync("./serviceAccountSource.json", "utf-8")
        );

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        const db = admin.firestore();
        console.log("Checking productionPrograms collection...");
        const snapshot = await db.collection("productionPrograms")
            .orderBy("dateProduction", "desc")
            .limit(10)
            .get();

        console.log(`Documents total: ${snapshot.size}`);

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateProd = data.dateProduction?.toDate ? data.dateProduction.toDate() : new Date(data.dateProduction);
            console.log(`ID: ${doc.id}`);
            console.log(`- dateProduction: ${dateProd?.toISOString()} (${data.dateProduction?.toString()})`);
            console.log(`- statut: ${data.statut}`);
            console.log(`- commandesClients count: ${data.commandesClients?.length || 0}`);
            console.log(`- quantitesBoutique count: ${data.quantitesBoutique?.length || 0}`);
            console.log(`- updatedAt: ${data.updatedAt?.toDate()?.toISOString()}`);
            console.log("------------------------");
        });

    } catch (e) {
        console.error("Erreur:", e);
    }
}

main();
