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

    async function createUserProfile() {
        const uid = "99Zpzats79N1bShUTj9EieuZWPC2";
        const email = "chezmina@boulangerie.sn";

        console.log(`Creating user profile for ${uid} (${email})...`);

        try {
            const userDocRef = db.collection('users').doc(uid);

            const userData = {
                email: email,
                nom: "Chez Mina",
                prenom: "Boulangerie",
                role: "admin",
                active: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await userDocRef.set(userData);

            console.log("✅ User profile created successfully!");
            console.log(userData);

        } catch (error) {
            console.error("Error creating user profile:", error);
        }
    }

    createUserProfile()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });

} catch (err) {
    console.error("Initialization error:", err);
    process.exit(1);
}
