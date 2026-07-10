const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'peer-coaching-network' });
const db = getFirestore(app);
async function run() {
  const users = await db.collection('users').get();
  console.log(`Found ${users.size} users`);
  users.forEach(doc => {
    const data = doc.data();
    console.log(`User: ${data.displayName || data.email} (UID: ${doc.id})`);
    console.log(`  Role: ${data.userRole}, Status: ${data.userStatus}`);
    if (data.userStatus !== 'active') {
      console.log(`  -> Auto-approving...`);
      db.collection('users').doc(doc.id).update({ userStatus: 'active' });
    }
  });
  // also check coachAvailabilityByDate
  const shards = await db.collection('coachAvailabilityByDate').get();
  console.log(`\nFound ${shards.size} availability shards`);
  shards.forEach(doc => {
    console.log(`Shard: ${doc.id} -> ${doc.data().dateISO}, slots: ${doc.data().freeSlots?.length}`);
  });
}
run().then(() => setTimeout(() => process.exit(0), 1000));
