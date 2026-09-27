import { Telegraf, Markup } from 'telegraf';
import { config } from '../config';
import { LicenseService } from '../services/license.service';
import { db } from '../db';
import { LicenseStatus } from '@prisma/client';

export const initBot = () => {
  if (!config.telegramBotToken) {
    console.log('Telegram bot disabled: TELEGRAM_BOT_TOKEN not configured');
    return null;
  }

  const bot = new Telegraf(config.telegramBotToken);

  const adminMiddleware = (ctx: any, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (config.telegramAdminIds.includes(userId || '')) {
      return next();
    }
    ctx.reply('Unauthorized');
  };

  const getAdminId = (ctx: any) => ctx.from?.id.toString() || 'unknown';

  bot.command('start', (ctx) => ctx.reply('Swag-External Admin Bot'));
  bot.command('status', adminMiddleware, (ctx) => ctx.reply('System operational'));

  bot.command('key_create', adminMiddleware, async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) return ctx.reply('Usage: /key_create <days> [maxDevices]');
    
    const days = parseInt(args[1]);
    const maxDevices = args[2] ? parseInt(args[2]) : 1;
    
    try {
        const { keyIdentifier, rawSecret } = await LicenseService.createLicense(days, maxDevices, 'Created via Telegram', getAdminId(ctx));
        ctx.reply(`Key Created:\nID: ${keyIdentifier}\nSecret: ${rawSecret}`);
    } catch (e: any) {
        ctx.reply(`Error: ${e.message}`);
    }
  });

  bot.command('key_list', adminMiddleware, async (ctx) => {
      const licenses = await db.licenseKey.findMany({ take: 20 });
      let message = 'Licenses (ID - Status):\n';
      for (const l of licenses) {
          message += `${l.keyIdentifier} - ${l.status}\n`;
      }
      ctx.reply(message || 'No licenses found');
  });

  bot.command('key_info', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_info <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] }, include: { devices: true } });
      if (!lic) return ctx.reply('License not found');
      
      ctx.reply(`
ID: ${lic.keyIdentifier}
Status: ${lic.status}
Paused (Ind/Glob): ${lic.pausedIndividual}/${lic.pausedGlobal}
Expires: ${lic.expiresAt?.toISOString() || 'N/A'}
Devices: ${lic.devices.length}/${lic.maxDevices}
      `);
  });

  bot.command('key_pause', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_pause <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] } });
      if (!lic) return ctx.reply('License not found');
      
      await LicenseService.pauseIndividual(lic.id, getAdminId(ctx));
      ctx.reply('License paused');
  });

  bot.command('key_resume', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_resume <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] } });
      if (!lic) return ctx.reply('License not found');
      
      await LicenseService.resumeIndividual(lic.id, getAdminId(ctx));
      ctx.reply('License resumed');
  });

  bot.command('key_revoke', adminMiddleware, async (ctx) => {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) return ctx.reply('Usage: /key_revoke <keyIdentifier>');
      
      const lic = await db.licenseKey.findUnique({ where: { keyIdentifier: args[1] } });
      if (!lic) return ctx.reply('License not found');
      
      ctx.reply(`Confirm revoke for ${args[1]}?`, Markup.inlineKeyboard([
          Markup.button.callback('Yes', `revoke_${lic.id}`),
          Markup.button.callback('No', 'cancel')
      ]));
  });

  bot.action(/^revoke_(.+)$/, adminMiddleware, async (ctx: any) => {
      await LicenseService.revoke(ctx.match[1], getAdminId(ctx));
      ctx.editMessageText('License revoked');
  });

  bot.command('keys_pause_all', adminMiddleware, async (ctx) => {
      ctx.reply('Confirm pause ALL active licenses?', Markup.inlineKeyboard([
          Markup.button.callback('Yes', 'pause_all'),
          Markup.button.callback('No', 'cancel')
      ]));
  });

  bot.action('pause_all', adminMiddleware, async (ctx: any) => {
      await LicenseService.pauseAll(getAdminId(ctx));
      ctx.editMessageText('All licenses paused');
  });

  bot.command('keys_resume_all', adminMiddleware, async (ctx) => {
      ctx.reply('Confirm resume ALL paused licenses?', Markup.inlineKeyboard([
          Markup.button.callback('Yes', 'resume_all'),
          Markup.button.callback('No', 'cancel')
      ]));
  });

  bot.action('resume_all', adminMiddleware, async (ctx: any) => {
      await LicenseService.resumeAll(getAdminId(ctx));
      ctx.editMessageText('All licenses resumed');
  });

  bot.action('cancel', (ctx: any) => ctx.editMessageText('Action cancelled'));

  bot.launch();
  console.log('Telegram bot started');
  return bot;
};
