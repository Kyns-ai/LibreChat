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

  const col = client.db('test').collection('agents');

  const found = await col.find({ name: /kyns.?image/i }, { projection: { _id: 1, name: 1 } }).toArray();
  console.log(`Encontrados ${found.length} agente(s):`);
  found.forEach((a) => console.log(`  _id=${a._id}  name="${a.name}"`));

  if (found.length > 0) {
    const result = await col.deleteMany({ _id: { $in: found.map((a) => a._id) } });
    console.log(`Deletados: ${result.deletedCount}`);
  } else {
    console.log('Nenhum agente encontrado.');
  }

  await client.close();
  console.log('Concluído.');
}

run().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
