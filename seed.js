require('dotenv').config();
const readline = require('readline');
const { connectDB } = require('./config/db');
const User = require('./models/User');

async function run() {
  await connectDB();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q) => new Promise((res) => rl.question(q, res));
  try {
    const name = (await question('Admin name: ')).trim() || 'Admin';
    const email = (await question('Admin email: ')).trim();
    const password = (await question('Admin password: ')).trim();
    if (!email || !password) throw new Error('Email and password are required');
    const exists = await User.findOne({ email });
    if (exists) throw new Error('Admin already exists');
    await User.create({ name, email, password, role: 'admin' });
    console.log('Admin user created.');
  } catch (e) {
    console.error('Failed:', e.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

run();


