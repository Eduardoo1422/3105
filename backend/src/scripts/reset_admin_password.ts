import 'dotenv/config';
import path from 'path';
import fs from 'fs';

// Ensure backend .env is loaded explicitly if needed
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

import readline from 'readline';
import bcrypt from 'bcrypt';

function prompt(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;
    const isRaw = stdin.isRaw;
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (char: string) => {
      const code = char.charCodeAt(0);
      // Enter (CR or LF)
      if (code === 13 || code === 10) {
        if (stdin.setRawMode) {
          stdin.setRawMode(isRaw || false);
        }
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(password);
      } else if (code === 127 || code === 8) {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (code === 3) {
        // Ctrl+C
        if (stdin.setRawMode) {
          stdin.setRawMode(isRaw || false);
        }
        process.stdout.write('\nOperation cancelled.\n');
        process.exit(0);
      } else {
        password += char;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

function getSafeDbInfo(): { host: string; name: string } {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return { host: 'NOT_FOUND', name: 'NOT_FOUND' };
  try {
    const parsed = new URL(dbUrl);
    return {
      host: `${parsed.hostname}:${parsed.port || '5432'}`,
      name: parsed.pathname || 'UNKNOWN'
    };
  } catch {
    const match = dbUrl.match(/@([^:\/]+)(?::(\d+))?(\/[^\?]+)?/);
    if (match) {
      return {
        host: `${match[1]}:${match[2] || '5432'}`,
        name: match[3] || 'UNKNOWN'
      };
    }
    return { host: 'PARSE_ERROR', name: 'PARSE_ERROR' };
  }
}

async function main() {
  console.log('=== ZROK SECURE ADMIN PASSWORD RESET & CREATION SCRIPT ===\n');

  const dbInfo = getSafeDbInfo();
  console.log(`Target Database Host: ${dbInfo.host}`);
  console.log(`Target Database Name: ${dbInfo.name}`);

  // Localhost safety check & explicit confirmation
  const isLocalhost = dbInfo.host.includes('localhost') || dbInfo.host.includes('127.0.0.1');
  if (isLocalhost) {
    console.log('\n[SECURITY NOTICE]: Target database is pointing to a LOCALHOST instance.');
    const localConfirm = await prompt('Do you explicitly wish to modify the local database? (y/N): ');
    if (localConfirm.toLowerCase() !== 'y') {
      console.log('Operation aborted by user.');
      process.exit(0);
    }
  }

  // Import db dynamically AFTER dotenv configuration is loaded
  const { db } = await import('../db');

  try {
    const username = await prompt('\nEnter administrator username: ');
    if (!username) {
      console.error('Error: Username cannot be empty.');
      await db.$disconnect();
      process.exit(1);
    }

    // Check if user exists
    const user = await db.user.findUnique({ where: { username } });

    if (!user) {
      console.log(`\nUser '${username}' does not exist in the database.`);
      const createConfirm = await prompt(`Do you want to create a new administrator account with username '${username}'? (y/N): `);
      if (createConfirm.toLowerCase() !== 'y') {
        console.log('Operation cancelled by user.');
        await db.$disconnect();
        process.exit(0);
      }

      const newPassword = await promptHidden('Enter new password for administrator (min 12 chars): ');
      if (!newPassword || newPassword.length < 12) {
        console.error('Error: Password must be at least 12 characters long.');
        await db.$disconnect();
        process.exit(1);
      }

      const confirmPassword = await promptHidden('Confirm new password: ');
      if (newPassword !== confirmPassword) {
        console.error('Error: Passwords do not match. Operation cancelled.');
        await db.$disconnect();
        process.exit(1);
      }

      const finalConfirm = await prompt(`Are you sure you want to create the new administrator '${username}'? (y/N): `);
      if (finalConfirm.toLowerCase() !== 'y') {
        console.log('Operation cancelled by user.');
        await db.$disconnect();
        process.exit(0);
      }

      console.log('\nGenerating secure password hash...');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.user.create({
        data: {
          username,
          password: hashedPassword,
          role: 'ADMIN'
        }
      });

      console.log(`\nSuccess: New administrator account '${username}' has been successfully created.`);
    } else {
      // User exists - verify role
      if (user.role !== 'ADMIN') {
        console.error(`Error: User '${username}' exists with role '${user.role}' and cannot be automatically promoted. Operation refused.`);
        await db.$disconnect();
        process.exit(1);
      }

      console.log(`Administrator account verified for '${username}'.`);

      const newPassword = await promptHidden('Enter new password (min 12 chars): ');
      if (!newPassword || newPassword.length < 12) {
        console.error('Error: Password must be at least 12 characters long.');
        await db.$disconnect();
        process.exit(1);
      }

      const confirmPassword = await promptHidden('Confirm new password: ');
      if (newPassword !== confirmPassword) {
        console.error('Error: Passwords do not match. Operation cancelled.');
        await db.$disconnect();
        process.exit(1);
      }

      const finalConfirm = await prompt(`Are you sure you want to update the password for administrator '${username}'? (y/N): `);
      if (finalConfirm.toLowerCase() !== 'y') {
        console.log('Operation cancelled by user.');
        await db.$disconnect();
        process.exit(0);
      }

      console.log('\nGenerating secure password hash...');
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.user.update({
        where: { username },
        data: { password: hashedPassword }
      });

      console.log(`\nSuccess: Password for administrator '${username}' has been securely reset.`);
    }
  } catch (e: any) {
    console.error('Error during administrator operation:', e.message);
  } finally {
    await db.$disconnect();
  }
}

main();
