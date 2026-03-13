#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGO_URI ||
  'mongodb://mongo:68eca824oqwbofbsk82mjy8jofi8vn1t@roundhouse.proxy.rlwy.net:40487/?authSource=admin';

async function run() {
  console.log('Conectando ao MongoDB...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  console.log('Conectado!');

  const db = client.db('LibreChat');

  const collections = await db.listCollections().toArray();
  console.log('Coleções no banco:');
  collections.forEach((c) => console.log(' -', c.name));

  const agentCollections = collections.filter((c) =>
    /agent|preset|character|assistant/i.test(c.name),
  );
  console.log('\nColeções candidatas (agent/preset/character/assistant):');

  for (const colInfo of agentCollections) {
    const col = db.collection(colInfo.name);
    const docs = await col
      .find({}, { projection: { _id: 1, name: 1, author: 1, projectIds: 1 } })
      .toArray();
    console.log(`\n[${colInfo.name}] — ${docs.length} doc(s):`);
    docs.forEach((d) =>
      console.log(`  _id=${d._id}  name="${d.name}"  projects=${JSON.stringify(d.projectIds)}`),
    );
  }

  await client.close();
  console.log('Concluído.');
}

run().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
