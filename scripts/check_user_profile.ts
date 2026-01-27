
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const serviceAccountPath = path.resolve('./serviceAccountTarget.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error("Service account file not found at " + serviceAccountPath);
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

try {
    initializeApp({
        credential: cert(serviceAccount)
    });

    const db = getFirestore();

    async function checkUser() {
        const uid = "99Zpzats79N1bShUTj9EieuZWPC2";
        const email = "chezmina@boulangerie.sn";

        console.log(`Checking for user ${uid} (${email})...`);

        try {
            const userDocRef = db.collection('users').doc(uid);
            const userDoc = await userDocRef.get();

            if (userDoc.exists) {
                console.log("User profile exists in Firestore:");
                console.log(userDoc.data());
            } else {
                console.log("User profile does NOT exist in Firestore.");
            }
        } catch (error) {
            console.error("Error accessing Firestore:", error);
        }
    }

    checkUser().catch(console.error);

} catch (err) {
    console.error("Initialization error:", err);
}
