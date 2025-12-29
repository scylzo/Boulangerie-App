import fs from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ServiceAccount } from "firebase-admin";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

function convertDates(obj: any): any {
    if (typeof obj === "string" && ISO_DATE_REGEX.test(obj)) {
        return new Date(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(convertDates);
    }

    if (obj !== null && typeof obj === "object") {
        const newObj: any = {};
        for (const key in obj) {
            newObj[key] = convertDates(obj[key]);
        }
        return newObj;
    }

    return obj;
}

async function main() {
    // 🔐 Initialisation Firebase (projet cible)
    const serviceAccount = JSON.parse(
        fs.readFileSync("./serviceAccountTarget.json", "utf-8")
    ) as ServiceAccount;

    initializeApp({
        credential: cert(serviceAccount),
    });

    const db = getFirestore();

    // 📦 Chargement du JSON exporté
    const rawData = JSON.parse(
        fs.readFileSync("./matieres.json", "utf-8")
    ) as Array<{ id: string;[key: string]: any }>;

    // 🔄 Conversion des dates
    const data = convertDates(rawData);

    console.log(`📄 ${data.length} documents à importer`);

    const BATCH_SIZE = 400;
    let batchCount = 0;

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = data.slice(i, i + BATCH_SIZE);

        chunk.forEach((doc: any) => {
            const { id, ...fields } = doc;
            const ref = db.collection("matieres").doc(id);
            batch.set(ref, fields, { merge: false });
        });

        await batch.commit();
        batchCount++;

        console.log(
            `✅ Batch ${batchCount} importé (${i + chunk.length}/${data.length})`
        );
    }

    console.log("🎉 Migration terminée avec succès");
}

main().catch((err) => {
    console.error("❌ Erreur de migration", err);
    process.exit(1);
});
