import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ServiceAccount } from "firebase-admin";

async function main() {
    // 🔐 Firebase SOURCE
    const serviceAccount = JSON.parse(
        fs.readFileSync("./serviceAccountSource.json", "utf-8")
    ) as ServiceAccount;

    initializeApp({
        credential: cert(serviceAccount),
    });

    const db = getFirestore();

    const COLLECTION_NAME = "productionPrograms";

    console.log("📥 Lecture de la collection source...");

    const snapshot = await db.collection(COLLECTION_NAME).get();

    const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));

    fs.writeFileSync(
        "./productionPrograms.json",
        JSON.stringify(data, null, 2),
        "utf-8"
    );

    console.log(
        `✅ Fichier généré : productionPrograms.json (${data.length} documents)`
    );
}

main().catch((err) => {
    console.error("❌ Erreur export", err);
    process.exit(1);
});
