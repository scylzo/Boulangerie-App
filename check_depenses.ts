
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

async function main() {
    try {
        const serviceAccount = JSON.parse(
            fs.readFileSync("./serviceAccountTarget.json", "utf-8")
        );

        initializeApp({
            credential: cert(serviceAccount),
        });

        const db = getFirestore();
        const snapshot = await db.collection("depenses").get();

        console.log(`Documents récupérés : ${snapshot.size}`);

        snapshot.forEach(doc => {
            console.log(doc.id, doc.data());
        });

    } catch (e) {
        console.error("Erreur:", e);
    }
}

main();
